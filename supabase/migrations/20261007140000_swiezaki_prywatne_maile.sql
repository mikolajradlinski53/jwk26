-- ============================================================
-- Sekta Wyjazdowa — Świeżaki logują się prywatnym mailem
-- ============================================================
--
-- Decyzja Mikołaja 2026-10-07: Świeżaki nie mają jeszcze adresów
-- @samorzad.ue.wroc.pl (najwyżej 24 osoby). Wariant „otwarte + ręczna
-- weryfikacja”:
-- - konto może założyć każdy adres e-mail (wyzwalacz pilnuje już tylko, żeby
--   adres w ogóle był - logowanie numerem telefonu dalej odpada);
-- - konto spoza domeny zapisuje się wyłącznie do tury Świeżaków
--   (zloz_zgloszenie, błąd TURA_TYLKO_SAMORZAD);
-- - mail do organizatorów podaje adres i ostrzega przy adresie spoza domeny;
--   kto naprawdę jest Świeżakiem, sprawdza organizator przy akceptacji.

-- ---------- Czy adres jest samorządowy ----------
-- Kotwica na końcu: ...@samorzad.ue.wroc.pl.evil.com nie przechodzi.
create function public.konto_samorzadowe(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(p_email) like '%@samorzad.ue.wroc.pl', false);
$$;

grant execute on function public.konto_samorzadowe(text) to anon, authenticated;

-- ---------- Bramka kont: już bez domeny ----------
create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Warunek na NULL jest konieczny: rejestracja przez numer telefonu zostawia
  -- email pusty. Domena nie jest już sprawdzana (Świeżaki - prywatne maile).
  if new.email is null or btrim(new.email) = '' then
    raise exception 'Konto wymaga adresu e-mail';
  end if;
  return new;
end;
$$;

-- ---------- Zgłoszenie: prywatny mail tylko do Świeżaków ----------
-- Kopia zloz_zgloszenie z 20260929140000 z jednym dodanym warunkiem.
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
  v_ice_rel  text := nullif(btrim(p_wrazliwe ->> 'ice_relacja'), '');
  v_dieta    text := nullif(btrim(p_wrazliwe ->> 'dieta'), '');
  v_alergie  text := nullif(btrim(p_wrazliwe ->> 'alergie'), '');
  v_choroby  text := nullif(btrim(p_wrazliwe ->> 'choroby_leki'), '');
  v_ice      boolean;
  v_zdrowie  boolean;
begin
  if v_user is null then
    raise exception 'Brak sesji';
  end if;

  -- Przyjęta osoba nie składa drugiego zgłoszenia. Wyjątek: admin, który
  -- dostał dostęp ręcznie i nie ma jeszcze żadnego zgłoszenia — też jedzie,
  -- więc przechodzi formularz jak wszyscy (bramka w proxy.ts go tu kieruje).
  -- Odrzucenie jego zgłoszenia nie zabiera dostępu: review_registration nie
  -- degraduje osoby już przyjętej.
  if public.is_approved() and (
       not public.is_admin()
       or exists (
         select 1 from public.registrations
         where user_id = v_user and status in ('pending'::public.user_status, 'approved'::public.user_status)
       )
     ) then
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
  v_ice     := v_ice_imie is not null or v_ice_rel is not null or v_ice_tel is not null;
  v_zdrowie := v_dieta is not null or v_alergie is not null or v_choroby is not null;

  if v_ice then
    -- Relacja jest obowiązkowa razem z resztą ICE: w nagłym wypadku
    -- „dzwonię do Anny" nic nie mówi, „dzwonię do mamy" — tak.
    if v_ice_imie is null or v_ice_rel is null or v_ice_tel is null
       or length(v_ice_rel) > 40
       or v_ice_tel !~ '^\+?[0-9 ()-]{9,20}$' then
      raise exception 'Kontakt ICE wymaga imienia, relacji (do 40 znakow) i poprawnego telefonu';
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

  -- Konto spoza domeny Samorządu (prywatny mail) zapisuje się wyłącznie
  -- do Świeżaków - Działacze i Alumni mają adresy samorządowe. Kto naprawdę
  -- jest Świeżakiem, sprawdza organizator przy akceptacji.
  if v_pula.klucz <> 'swiezaki' and not public.konto_samorzadowe(
       (select email from public.profiles where id = v_user)
     ) then
    raise exception 'TURA_TYLKO_SAMORZAD';
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
      registration_id, ice_imie, ice_relacja, ice_telefon, ice_poinformowany,
      dieta, alergie, choroby_leki, zgoda_art9_at
    )
    values (
      v_id, v_ice_imie, v_ice_rel, v_ice_tel, v_ice,
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

-- ---------- Mail do organizatorów: adres i ostrzeżenie ----------
-- Kopia po_zgloszeniu_mail z 20261005120000 z adresem e-mail w treści.
create or replace function public.po_zgloszeniu_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pula   public.pule%rowtype;
  v_zajete integer;
  v_lista  text;
  v_email  text;
  v_obcy   text := '';
begin
  if new.pula is null then
    return null;
  end if;

  -- Mail to dodatek: żaden błąd wysyłki nie może wycofać zgłoszenia.
  begin
    select * into v_pula from public.pule where klucz = new.pula;
    select email into v_email from public.profiles where id = new.user_id;
    if not public.konto_samorzadowe(v_email) then
      v_obcy := E'\nUWAGA: mail spoza Samorządu - sprawdź, czy to Świeżak.';
    end if;

    select count(*)::integer into v_zajete
    from public.registrations
    where pula = new.pula
      and not rezerwa
      and status in ('pending'::public.user_status, 'approved'::public.user_status);

    v_lista := case
      when new.rezerwa then format('lista rezerwowa (numer %s)', new.kolejnosc_rezerwy)
      else format('lista główna (zajęte %s z %s miejsc)', v_zajete, v_pula.miejsca)
    end;

    perform public.wyslij_mail_organizatorom(
      'zgloszenie',
      new.pula,
      format('JWK26: nowe zgłoszenie - %s', v_pula.nazwa),
      format(
        E'Nowe zgłoszenie w turze %s.\n\nOsoba: %s\nE-mail: %s%s\nLista: %s\n\nSprawdź i zdecyduj w panelu: https://www.jwk26.pl/app/admin/rejestracje',
        v_pula.nazwa, coalesce(new.full_name, '(bez nazwiska)'), coalesce(v_email, '(brak)'), v_obcy, v_lista
      )
    );

    -- Zgłoszenie, które zajęło ostatnie miejsce. Równość, nie „>=”: pula
    -- jest zablokowana w zloz_zgloszenie (for update), więc dokładnie jedno
    -- zgłoszenie ją domyka; kolejne idą już na rezerwę.
    if not new.rezerwa and v_pula.miejsca > 0 and v_zajete = v_pula.miejsca then
      perform public.wyslij_mail_organizatorom(
        'pula_pelna',
        new.pula,
        format('JWK26: tura %s zapełniona', v_pula.nazwa),
        format(
          E'Tura %s ma komplet: %s z %s miejsc.\n\nKolejne osoby zapisują się na listę rezerwową bez wpłaty.',
          v_pula.nazwa, v_zajete, v_pula.miejsca
        )
      );
    end if;
  exception when others then
    raise warning 'Mail o zgłoszeniu nie wyszedł: %', sqlerrm;
  end;

  return null;
end;
$$;
