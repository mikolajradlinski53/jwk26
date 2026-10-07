-- ============================================================
-- Sekta Wyjazdowa — neutralne odpowiedzi o alkohol w eksporcie arkusza
-- ============================================================
--
-- Decyzja Mikołaja 2026-10-07: pytanie „Czy pijesz alkohol?” z odpowiedziami
-- „Nie piję” / „Okazjonalnie” / „Tak” zamiast żartobliwych. Wartości w bazie
-- (nie / czasami / tak) bez zmian - kopia eksport_arkusza z 20260928140000
-- różni się wyłącznie trzema napisami. `create or replace` zachowuje
-- uprawnienia nadane w oryginale.

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
      case when z.zwolnienie_od is not null then
        to_char(z.zwolnienie_od, 'HH24:MI') || '–' || to_char(z.zwolnienie_do, 'HH24:MI')
      end,
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
