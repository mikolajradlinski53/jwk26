-- ============================================================
-- Sekta Wyjazdowa — formularz zapisu: przedziały zwolnienia, poczekalnia,
-- porzucone konta
-- ============================================================
--
-- Zgłoszenie Mikołaja 2026-10-11 (zapisy ruszają 12.10):
-- 1. Zwolnienie rektorskie jako przedziały zajęć do zaznaczenia, kilka naraz:
--    11:30-13:00, 13:15-14:45, 15:00-16:30, 16:45-17:15, 17:30-19:00.
--    Kolumny zwolnienie_od/do zostają dla historii, nowe zgłoszenia ich nie
--    wypełniają.
-- 2. Poczekalnia: przyjęci uczestnicy (nie admini) widzą ekran z licznikiem
--    do `otwarcie_platformy` (ustawienie w panelu; puste = otwarte).
-- 3. Porzucone konta: ktoś się zalogował, ale nie złożył zgłoszenia - konto
--    znika po 48 h (co godzinę), żeby w bazie nie zostawały puste konta.

-- ---------- 1. Przedziały zwolnienia ----------
alter table registrations
  add column zwolnienie_sloty text[]
    check (
      zwolnienie_sloty is null
      or (cardinality(zwolnienie_sloty) between 1 and 5
          and zwolnienie_sloty <@ array['11:30-13:00', '13:15-14:45', '15:00-16:30', '16:45-17:15', '17:30-19:00'])
    );

-- Kopia zloz_zgloszenie z 20261007140000 - zmienione wyłącznie zwolnienie.
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
  v_sloty    text[];
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

  -- Zwolnienie rektorskie: przedziały zajęć do zaznaczenia (kilka naraz),
  -- te same co PRZEDZIALY_ZWOLNIENIA w formularzu. Stara wersja formularza
  -- (godziny od-do) mogła zostać w pamięci telefonu - zamiast zgadywać
  -- przedziały, prosimy o odświeżenie.
  if p_dane ? 'zwolnienie_od' or p_dane ? 'zwolnienie_do' then
    raise exception 'FORMULARZ_NIEAKTUALNY';
  end if;

  if jsonb_typeof(p_dane -> 'zwolnienie_sloty') = 'array'
     and jsonb_array_length(p_dane -> 'zwolnienie_sloty') > 0 then
    select array_agg(distinct s order by s) into v_sloty
    from jsonb_array_elements_text(p_dane -> 'zwolnienie_sloty') as s;
    if not (v_sloty <@ array['11:30-13:00', '13:15-14:45', '15:00-16:30', '16:45-17:15', '17:30-19:00']) then
      raise exception 'Zwolnienie rektorskie: nieznany przedzial godzin';
    end if;
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
  if v_pula.klucz = 'alumni' and v_sloty is not null then
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
    zwolnienie_sloty, alkohol
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
    v_sloty, v_alkohol
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

-- ---------- 2. Otwarcie platformy ----------
-- Pusta wartość = platforma otwarta (bezpieczne dla nowej bazy). Czyta każdy
-- zalogowany (settings_read przepuszcza klucze nieukryte).
insert into app_settings (key, value) values ('otwarcie_platformy', '""'::jsonb)
on conflict (key) do nothing;

-- ---------- 3. Porzucone konta ----------
-- Konto bez żadnego zgłoszenia, nieprzyjęte i nie admina, starsze niż 48 h.
-- Profil idzie kaskadą z auth.users. Kto wróci później, zaloguje się od nowa.
-- Parametr tylko dla testów (świeżego konta nie da się postarzyć) - cron
-- woła bez argumentu.
create function public.usun_porzucone_konta(p_starsze_niz interval default interval '48 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ile integer;
begin
  delete from auth.users u
  using public.profiles p
  where p.id = u.id
    and p.role <> 'admin'
    and p.status = 'pending'
    and u.created_at < now() - p_starsze_niz
    and not exists (select 1 from public.registrations r where r.user_id = u.id);
  get diagnostics v_ile = row_count;
  return v_ile;
end;
$$;

revoke execute on function public.usun_porzucone_konta(interval) from public, anon, authenticated;

select cron.schedule('usun-porzucone-konta', '41 * * * *', 'select public.usun_porzucone_konta()');

-- ---------- Eksport do arkusza: przedziały zwolnienia ----------
-- Kopia eksport_arkusza z 20261007120000; zwolnienie jako lista przedziałów,
-- dla zgłoszeń sprzed zmiany dawne „od-do”.
create or replace function public.eksport_arkusza(p_sekret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ok        boolean;
  v_zapisy    jsonb;
  v_wrazliwe  jsonb;
  v_pule      jsonb;
begin
  select p_sekret is not null and p_sekret = wartosc into v_ok
  from public.sekrety
  where klucz = 'arkusz';

  if v_ok is not true then
    raise exception 'Brak dostepu';
  end if;

  with z as (
    select r.*,
           p.email,
           t.name as druzyna,
           -- Pozycja w kolejce liczona jak w pozycja_w_rezerwie: numer rośnie
           -- przez cały czas zapisów, pozycja to miejsce wśród czekających.
           case when r.rezerwa and r.status = 'pending'::public.user_status then
             row_number() over (
               partition by r.pula, (r.rezerwa and r.status = 'pending'::public.user_status)
               order by r.kolejnosc_rezerwy
             )
           end as pozycja,
           case r.pula
             when 'dzialacze' then 'Działacze'
             when 'swiezaki'  then 'Świeżaki'
             when 'alumni'    then 'Alumni'
           end as pula_nazwa,
           case
             when r.status = 'approved'::public.user_status then 'Przyjęte'
             when r.status = 'rejected'::public.user_status then 'Odrzucone'
             when r.rezerwa then 'Rezerwa'
             when r.proof_path is null then 'Czeka na przelew'
             else 'Czeka na akceptację'
           end as status_nazwa
    from public.registrations r
    join public.profiles p on p.id = r.user_id
    left join public.teams t on t.id = p.team_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_array(
      to_char(z.created_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI'),
      case when z.pozycja is not null then 'Rezerwa (' || z.pozycja || '.)' else z.status_nazwa end,
      z.pula_nazwa,
      coalesce(z.nazwisko, z.full_name),
      z.imie,
      z.ksywka,
      z.nr_indeksu,
      to_char(z.data_urodzenia, 'YYYY-MM-DD'),
      z.phone,
      z.email,
      z.druzyna,
      case z.dojazd
        when 'autokar_oba'    then 'Jadę autokarem w obie strony'
        when 'autokar_tam'    then 'Jadę autokarem tylko na wyjazd'
        when 'autokar_powrot' then 'Jadę autokarem tylko na powrót'
        when 'wlasny'         then 'Dojeżdżam samodzielnie w obie strony'
      end,
      coalesce(
        array_to_string(z.zwolnienie_sloty, ', '),
        case when z.zwolnienie_od is not null then
          to_char(z.zwolnienie_od, 'HH24:MI') || '–' || to_char(z.zwolnienie_do, 'HH24:MI')
        end
      ),
      case z.alkohol
        when 'nie'     then 'Nie piję'
        when 'czasami' then 'Okazjonalnie'
        when 'tak'     then 'Tak'
      end,
      case when z.zgoda_wizerunek then 'tak' else 'nie' end,
      case when z.sms_consent then 'tak' else 'nie' end,
      case when z.proof_path is not null then 'tak' else 'nie' end,
      z.piosenka,
      z.uwagi,
      z.review_note
    ) order by z.created_at), '[]'::jsonb)
  into v_zapisy
  from z;

  select coalesce(jsonb_agg(jsonb_build_array(
      coalesce(r.nazwisko, r.full_name),
      r.imie,
      case r.pula
        when 'dzialacze' then 'Działacze'
        when 'swiezaki'  then 'Świeżaki'
        when 'alumni'    then 'Alumni'
      end,
      case
        when r.status = 'approved'::public.user_status then 'Przyjęte'
        when r.status = 'rejected'::public.user_status then 'Odrzucone'
        when r.rezerwa then 'Rezerwa'
        else 'Oczekuje'
      end,
      coalesce(d.dieta, r.diet_notes),
      d.alergie,
      d.choroby_leki,
      case when d.ice_telefon is not null then
        coalesce(d.ice_imie, '')
          || case when d.ice_relacja is not null then ' (' || d.ice_relacja || ')' else '' end
          || ', ' || d.ice_telefon
      end
    ) order by r.nazwisko nulls last, r.imie), '[]'::jsonb)
  into v_wrazliwe
  from public.registrations r
  left join public.dane_wrazliwe d on d.registration_id = r.id
  where d.registration_id is not null or r.diet_notes is not null;

  select coalesce(jsonb_agg(jsonb_build_array(
      s.nazwa,
      case when s.otwarta then 'tak' else 'nie' end,
      s.miejsca,
      s.zajete,
      s.w_rezerwie
    ) order by s.kolejnosc), '[]'::jsonb)
  into v_pule
  from public.stan_pul() s;

  return jsonb_build_object(
    'wygenerowano', to_char(now() at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI:SS'),
    'podsumowanie', jsonb_build_object(
      'naglowki', jsonb_build_array('Pula', 'Otwarta', 'Miejsca', 'Zajęte', 'Rezerwa'),
      'wiersze', v_pule
    ),
    'zapisy', jsonb_build_object(
      'naglowki', jsonb_build_array(
        'Zgłoszono', 'Status', 'Pula', 'Nazwisko', 'Imię', 'Ksywka', 'Nr indeksu',
        'Data urodzenia', 'Telefon', 'E-mail', 'Drużyna', 'Dojazd', 'Zwolnienie 23.10',
        'Alkohol', 'Wizerunek', 'SMS', 'Przelew', 'Piosenka', 'Uwagi', 'Notatka organizatora'
      ),
      'wiersze', v_zapisy
    ),
    'wrazliwe', jsonb_build_object(
      'naglowki', jsonb_build_array(
        'Nazwisko', 'Imię', 'Pula', 'Status', 'Dieta', 'Alergie', 'Choroby i leki', 'ICE'
      ),
      'wiersze', v_wrazliwe
    )
  );
end;
$$;
