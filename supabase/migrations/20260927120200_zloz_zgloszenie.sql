-- ============================================================
-- Sekta Wyjazdowa — zapisy: składanie zgłoszenia
-- ============================================================
--
-- Jedyne wejście do registrations (D5). Wszystko w jednej transakcji:
-- akceptacje, dane, wiek, ICE, zdrowie, zdjęcie, blokada puli, liczenie
-- miejsc, zapis. Trigger na INSERT dałby to samo tylko z blokadą, a wtedy jest
-- tą samą funkcją, tyle że trudniejszą do przeczytania i przetestowania.

-- ---------- Ścieżka dowodu ----------
-- To samo, czego pilnowała polityka INSERT z hartowania bramy: własny folder
-- i żadnego `..`, które klient Storage znormalizowałby do cudzego pliku.
create function public.sciezka_dowodu_ok(p_sciezka text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_sciezka like ((select auth.uid())::text || '/%')
     and p_sciezka !~ '\.\.';
$$;

-- Pomocnicza wyłącznie dla funkcji poniżej, które idą prawami właściciela.
revoke execute on function public.sciezka_dowodu_ok(text) from anon, public, authenticated;

create function public.zloz_zgloszenie(
  p_dane             jsonb,
  p_wrazliwe         jsonb   default null,
  p_proof_path       text    default null,
  p_ocr_text         text    default null,
  p_ocr_confidence   real    default null,
  p_ocr_keywords_hit integer default 0,
  p_na_rezerwe       boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_pula     public.pule%rowtype;
  v_zajete   integer;
  v_rezerwa  boolean;
  v_kolejka  integer;
  v_prog     date;
  v_ur       date;
  v_id       uuid;
  v_imie     text := nullif(btrim(p_dane ->> 'imie'), '');
  v_nazwisko text := nullif(btrim(p_dane ->> 'nazwisko'), '');
  v_indeks   text := nullif(btrim(p_dane ->> 'nr_indeksu'), '');
  v_telefon  text := nullif(btrim(p_dane ->> 'telefon'), '');
  v_dojazd   text := p_dane ->> 'dojazd';
  v_ksywka   text := nullif(btrim(p_dane ->> 'ksywka'), '');
  v_ice_imie text := nullif(btrim(p_wrazliwe ->> 'ice_imie'), '');
  v_ice_tel  text := nullif(btrim(p_wrazliwe ->> 'ice_telefon'), '');
  v_dieta    text := nullif(btrim(p_wrazliwe ->> 'dieta'), '');
  v_alergie  text := nullif(btrim(p_wrazliwe ->> 'alergie'), '');
  v_choroby  text := nullif(btrim(p_wrazliwe ->> 'choroby_leki'), '');
  v_ice      boolean;
  v_zdrowie  boolean;
begin
  if v_user is null then
    raise exception 'Brak sesji';
  end if;

  -- Odrzucenie zgłoszenia osoby zaakceptowanej zbiłoby jej status na
  -- 'rejected' i wyrzuciło ją z aplikacji (hartowanie bramy, punkt 2).
  if public.is_approved() then
    raise exception 'Twoje zgloszenie jest juz zaakceptowane';
  end if;

  -- ---------- Krok 2: akceptacje ----------
  -- `is not true` łapie i false, i brak klucza (NULL).
  if (p_dane ->> 'akceptuje_klauzule')::boolean is not true
     or (p_dane ->> 'akceptuje_regulamin')::boolean is not true
     or (p_dane ->> 'akceptuje_szkody')::boolean is not true then
    raise exception 'Brak wymaganych akceptacji: klauzula, regulamin i oswiadczenie o szkodach';
  end if;

  if nullif(btrim(p_dane ->> 'wersja_zgod'), '') is null then
    raise exception 'Brak wersji zgod';
  end if;

  -- ---------- Krok 3: dane ----------
  if v_imie is null or v_nazwisko is null
     or length(v_imie) > 60 or length(v_nazwisko) > 60 then
    raise exception 'Podaj imie i nazwisko (do 60 znakow kazde)';
  end if;

  -- Ten sam wzorzec co TELEFON w src/lib/zapisy/formularz.ts.
  if v_telefon is null or v_telefon !~ '^\+?[0-9 ()-]{9,20}$' then
    raise exception 'Niepoprawny numer telefonu';
  end if;

  v_ur := (p_dane ->> 'data_urodzenia')::date;
  if v_ur is null or v_ur < date '1900-01-01' then
    raise exception 'Podaj date urodzenia';
  end if;

  -- D7: próg z data_jwk, liczony w strefie warszawskiej. data_jwk to
  -- 18:00 czasu polskiego, czyli 16:00 UTC — ten sam dzień, ale godzina
  -- przesunięta na 00:30 dałaby w UTC dzień wcześniej.
  select ((((value #>> '{}')::timestamptz) at time zone 'Europe/Warsaw')::date
          - interval '18 years')::date
    into v_prog
  from public.app_settings
  where key = 'data_jwk';

  if v_prog is null then
    raise exception 'Brak daty wyjazdu w ustawieniach';
  end if;

  if v_ur > v_prog then
    raise exception 'NIEPELNOLETNI';
  end if;

  -- ---------- Krok 6: o tobie ----------
  if v_dojazd is null
     or v_dojazd not in ('autokar_oba', 'autokar_tam', 'autokar_powrot', 'wlasny') then
    raise exception 'Wybierz sposob dojazdu';
  end if;

  if v_ksywka is null or length(v_ksywka) > 24 then
    raise exception 'Podaj podpis na identyfikator (do 24 znakow)';
  end if;

  -- ---------- Kroki 4 i 5: ICE i zdrowie ----------
  v_ice     := v_ice_imie is not null or v_ice_tel is not null;
  v_zdrowie := v_dieta is not null or v_alergie is not null or v_choroby is not null;

  if v_ice then
    if v_ice_imie is null or v_ice_tel is null
       or v_ice_tel !~ '^\+?[0-9 ()-]{9,20}$' then
      raise exception 'Kontakt ICE wymaga imienia i poprawnego telefonu';
    end if;
    -- Art. 14 RODO: organizator nie ma jak sam poinformować osoby ICE,
    -- więc zapis stoi na oświadczeniu uczestnika, że to zrobił.
    if (p_wrazliwe ->> 'ice_poinformowany')::boolean is not true then
      raise exception 'Brak potwierdzenia, ze osoba ICE wie o podaniu numeru';
    end if;
  end if;

  if v_zdrowie and (p_wrazliwe ->> 'zgoda_art9')::boolean is not true then
    raise exception 'Dane o zdrowiu wymagaja wyraznej zgody';
  end if;

  -- ---------- Zdjęcie ----------
  if p_proof_path is not null and not public.sciezka_dowodu_ok(p_proof_path) then
    raise exception 'Niepoprawna sciezka potwierdzenia przelewu';
  end if;

  -- ---------- Pula, pod blokadą ----------
  -- Blokada wiersza puli serializuje zapisy do tej samej tury. Bez niej dwa
  -- równoczesne wywołania policzą tyle samo zajętych i oba wejdą.
  select * into v_pula
  from public.pule
  where klucz = p_dane ->> 'pula'
  for update;

  if not found then
    raise exception 'Nieznana pula';
  end if;

  if v_pula.klucz <> 'alumni' and v_indeks is null then
    raise exception 'Podaj numer indeksu';
  end if;

  if v_indeks is not null and v_indeks !~ '^[0-9]{4,10}$' then
    raise exception 'Numer indeksu to od 4 do 10 cyfr';
  end if;

  -- Roboczy regulamin zamyka zapisy także w turze, która została otwarta
  -- wcześniej (D8): cofnięcie flagi nie może zostawić zapisów na regulamin,
  -- którego zarząd nie przyjął. Dla uczestnika to po prostu zamknięta tura.
  if not v_pula.otwarta or not public.regulamin_zatwierdzony() then
    raise exception 'PULA_ZAMKNIETA';
  end if;

  select count(*) into v_zajete
  from public.registrations
  where pula = v_pula.klucz
    and not rezerwa
    and status in ('pending'::public.user_status, 'approved'::public.user_status);

  if v_zajete >= v_pula.miejsca then
    -- Kod, nie zdanie: formularz po nim proponuje rezerwę (D3).
    if not p_na_rezerwe then
      raise exception 'PULA_PELNA';
    end if;
    v_rezerwa := true;
    -- Maksimum po całej puli, nie po obecnej rezerwie: numer awansowanej
    -- osoby nie może wrócić do obiegu i zrównać dwóch miejsc w kolejce.
    select coalesce(max(kolejnosc_rezerwy), 0) + 1 into v_kolejka
    from public.registrations
    where pula = v_pula.klucz;
  else
    -- Kod, nie zdanie. Trafia tu też osoba, której formularz pokazał pełną
    -- pulę (więc bez kroku przelewu), a miejsce zwolniło się, zanim wysłała.
    -- Formularz po tym kodzie odświeża stan pul i dokłada krok przelewu —
    -- bez tego ponawiałaby w kółko i dostawała ten sam błąd.
    if p_proof_path is null then
      raise exception 'PRZELEW_WYMAGANY';
    end if;
    v_rezerwa := false;
  end if;

  -- full_name zostaje wypełnione, bo ma `not null`, a stary panel
  -- i review_registration z niego korzystają.
  insert into public.registrations (
    user_id, full_name, phone, sms_consent,
    proof_path, ocr_text, ocr_confidence, ocr_keywords_hit,
    pula, imie, nazwisko, nr_indeksu, data_urodzenia, dojazd,
    ksywka, piosenka, uwagi, wersja_zgod, zgoda_wizerunek,
    rezerwa, kolejnosc_rezerwy
  )
  values (
    v_user, v_imie || ' ' || v_nazwisko, v_telefon,
    coalesce((p_dane ->> 'sms_consent')::boolean, false),
    p_proof_path, p_ocr_text, p_ocr_confidence, coalesce(p_ocr_keywords_hit, 0),
    v_pula.klucz, v_imie, v_nazwisko, v_indeks, v_ur, v_dojazd,
    v_ksywka, nullif(btrim(p_dane ->> 'piosenka'), ''),
    nullif(btrim(p_dane ->> 'uwagi'), ''),
    btrim(p_dane ->> 'wersja_zgod'),
    coalesce((p_dane ->> 'zgoda_wizerunek')::boolean, false),
    v_rezerwa, v_kolejka
  )
  returning id into v_id;

  -- Wiersz wrażliwy tylko wtedy, gdy jest co w nim zapisać (D6).
  if v_ice or v_zdrowie then
    insert into public.dane_wrazliwe (
      registration_id, ice_imie, ice_telefon, ice_poinformowany,
      dieta, alergie, choroby_leki, zgoda_art9_at
    )
    values (
      v_id, v_ice_imie, v_ice_tel, v_ice,
      v_dieta, v_alergie, v_choroby,
      case when v_zdrowie then now() end
    );
  end if;

  -- Telefon i zgoda SMS zapisywał dotąd klient wprost w profiles. Teraz robi
  -- to funkcja, żeby zgłoszenie i profil nie rozjechały się przy błędzie
  -- w połowie.
  update public.profiles
  set phone       = v_telefon,
      sms_consent = coalesce((p_dane ->> 'sms_consent')::boolean, false)
  where id = v_user;

  return jsonb_build_object('id', v_id, 'rezerwa', v_rezerwa);
end;
$$;

revoke execute on function public.zloz_zgloszenie(jsonb, jsonb, text, text, real, integer, boolean)
  from anon, public;
grant  execute on function public.zloz_zgloszenie(jsonb, jsonb, text, text, real, integer, boolean)
  to authenticated;

-- ---------- Zamknięcie bezpośredniego INSERT-u ----------
-- Polityka z hartowania bramy przepuszczała poprawne wiersze, ale nic nie
-- wiedziała o limicie puli, wieku ani zgodach. Zostawiona, pozwoliłaby
-- ominąć je wszystkie jednym insertem z konsoli.
drop policy registrations_insert_own on registrations;
revoke insert on registrations from anon, authenticated;

-- ---------- Granty: drugi zamek na pulach i danych wrażliwych ----------
-- Supabase nadaje anon i authenticated pełne granty na nowych tabelach.
-- RLS bez polityk zapisu już je zatrzymuje, ale pule decydują o limitach
-- miejsc, a dane wrażliwe to art. 9 RODO — tu nie polegamy na jednym zamku.
revoke all on pule from anon;
revoke insert, update, delete, truncate on pule from authenticated;
revoke all on dane_wrazliwe from authenticated;
grant  select on dane_wrazliwe to authenticated;

-- ---------- Numer w kolejce rezerwy jest unikalny w puli ----------
-- zloz_zgloszenie nadaje max+1 pod blokadą puli, więc duplikatu nie zrobi.
-- Indeks łapie wszystko inne (np. ręczny wpis kluczem serwisowym), zanim
-- pozycja_w_rezerwie pokaże dwóm osobom to samo miejsce w kolejce.
create unique index registrations_kolejka_rezerwy_idx
  on registrations (pula, kolejnosc_rezerwy)
  where kolejnosc_rezerwy is not null;

-- Rezerwa bez numeru dałaby w pozycja_w_rezerwie fałszywe „jesteś pierwszy"
-- (porównanie z NULL nie liczy nikogo). Po awansie rezerwa = false, więc
-- numer, który zostaje, niczego tu nie łamie.
alter table registrations
  add constraint registrations_rezerwa_ma_numer
  check (not rezerwa or kolejnosc_rezerwy is not null);
