-- ============================================================
-- Sekta Wyjazdowa — zapisy: zwolnienie rektorskie i pytanie o alkohol
-- ============================================================
--
-- Dwa dobrowolne pola dodane po przeglądzie tekstów przez IOD (wersja zgód
-- 2026-09-28). Oba siedzą w registrations, nie w dane_wrazliwe: zwolnienie to
-- sprawa organizacyjna, a odpowiedzi o alkohol celowo nie zawierają deklaracji
-- choroby („TAK, i to chętnie ;)", nie „jestem alkoholikiem"), więc nie są
-- danymi o zdrowiu z art. 9 RODO.

-- ---------- Kolumny ----------
alter table registrations
  add column zwolnienie_od time,
  add column zwolnienie_do time,
  add column alkohol       text check (alkohol in ('nie', 'czasami', 'tak'));

-- Zwolnienie na pierwszy dzień wyjazdu: od 12:00 (wtedy rusza wyjazd) do
-- 18:00, co pół godziny, koniec po początku. Obie godziny albo żadna.
-- Te same reguły powtarza zloz_zgloszenie z czytelnymi komunikatami — to
-- ograniczenie łapie wszystko, co ominęłoby funkcję (np. klucz serwisowy).
alter table registrations
  add constraint registrations_zwolnienie_komplet
    check ((zwolnienie_od is null) = (zwolnienie_do is null)),
  add constraint registrations_zwolnienie_zakres
    check (
      zwolnienie_od is null
      or (
        zwolnienie_od >= time '12:00'
        and zwolnienie_do <= time '18:00'
        and zwolnienie_od < zwolnienie_do
        and extract(minute from zwolnienie_od) in (0, 30)
        and extract(minute from zwolnienie_do) in (0, 30)
        and extract(second from zwolnienie_od) = 0
        and extract(second from zwolnienie_do) = 0
      )
    );

-- ---------- Składanie zgłoszenia ----------
-- Pełna treść z 20260927120200 plus walidacja i zapis dwóch nowych pól.
-- Sygnatura bez zmian, więc granty zostają; powtarzamy je na końcu, żeby ten
-- plik czytany osobno mówił całą prawdę.
create or replace function public.zloz_zgloszenie(
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
  v_alkohol  text := nullif(btrim(p_dane ->> 'alkohol'), '');
  v_zw_od    time;
  v_zw_do    time;
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

  -- D7: próg z data_jwk, liczony w strefie warszawskiej.
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

  if v_alkohol is not null and v_alkohol not in ('nie', 'czasami', 'tak') then
    raise exception 'Nieznana odpowiedz na pytanie o alkohol';
  end if;

  -- Zwolnienie rektorskie: obie godziny albo żadna, 12:00–18:00 co pół
  -- godziny, koniec po początku — te same reguły co GODZINY_ZWOLNIENIA
  -- w formularzu i ograniczenie registrations_zwolnienie_zakres.
  v_zw_od := nullif(btrim(p_dane ->> 'zwolnienie_od'), '')::time;
  v_zw_do := nullif(btrim(p_dane ->> 'zwolnienie_do'), '')::time;

  if (v_zw_od is null) <> (v_zw_do is null) then
    raise exception 'Zwolnienie rektorskie wymaga godziny poczatku i konca';
  end if;

  if v_zw_od is not null and not (
       v_zw_od >= time '12:00' and v_zw_do <= time '18:00'
       and v_zw_od < v_zw_do
       and extract(minute from v_zw_od) in (0, 30)
       and extract(minute from v_zw_do) in (0, 30)
       and extract(second from v_zw_od) = 0
       and extract(second from v_zw_do) = 0
     ) then
    raise exception 'Zwolnienie rektorskie: godziny od 12:00 do 18:00 co 30 minut, koniec po poczatku';
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

  -- Alumni nie studiują, więc formularz nie pyta ich o zwolnienie. Odbijamy
  -- zamiast po cichu zerować, bo taki zapis oznacza klienta spoza formularza.
  if v_pula.klucz = 'alumni' and v_zw_od is not null then
    raise exception 'Zwolnienie rektorskie dotyczy tylko studentow';
  end if;

  -- Roboczy regulamin zamyka zapisy także w turze otwartej wcześniej (D8).
  if not v_pula.otwarta or not public.regulamin_zatwierdzony() then
    raise exception 'PULA_ZAMKNIETA';
  end if;

  select count(*) into v_zajete
  from public.registrations
  where pula = v_pula.klucz
    and not rezerwa
    and status in ('pending'::public.user_status, 'approved'::public.user_status);

  if v_zajete >= v_pula.miejsca then
    if not p_na_rezerwe then
      raise exception 'PULA_PELNA';
    end if;
    v_rezerwa := true;
    select coalesce(max(kolejnosc_rezerwy), 0) + 1 into v_kolejka
    from public.registrations
    where pula = v_pula.klucz;
  else
    if p_proof_path is null then
      raise exception 'PRZELEW_WYMAGANY';
    end if;
    v_rezerwa := false;
  end if;

  insert into public.registrations (
    user_id, full_name, phone, sms_consent,
    proof_path, ocr_text, ocr_confidence, ocr_keywords_hit,
    pula, imie, nazwisko, nr_indeksu, data_urodzenia, dojazd,
    ksywka, piosenka, uwagi, wersja_zgod, zgoda_wizerunek,
    rezerwa, kolejnosc_rezerwy,
    zwolnienie_od, zwolnienie_do, alkohol
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
    v_rezerwa, v_kolejka,
    v_zw_od, v_zw_do, v_alkohol
  )
  returning id into v_id;

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
