-- ============================================================
-- Sekta Wyjazdowa — 6 drużyn po 9 osób, zapisy Działaczy od 11:55
-- ============================================================
--
-- Decyzje Mikołaja 2026-10-11 przed zapisami 12.10:
-- 1. Sześć drużyn (Drużyna 5 i 6 dochodzą do 1-4), najwyżej 9 przyjętych
--    uczestników w drużynie (Kadra się nie liczy) - `druzyna_limit`.
-- 2. Tura Działaczy: 30 miejsc, otwiera się sama 12.10 o 11:55 (pg_cron
--    w GMT: 09:55), odsłona zapisów na landingu też o 11:55.

insert into teams (name, slug, color, numer) values
  ('Drużyna 5', 'mgla', '#4f6d8a', 5),
  ('Drużyna 6', 'cien', '#5e7d4f', 6)
on conflict (slug) do nothing;

insert into app_settings (key, value) values ('druzyna_limit', '9')
on conflict (key) do update set value = excluded.value;

-- Kopia review_registration z 20260927120420 z limitem drużyny.
create or replace function public.review_registration(
  p_registration_id uuid,
  p_approve         boolean,
  p_team_id         uuid default null,
  p_note            text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid;
  v_full_name text;
  v_ksywka    text;
  v_rezerwa   boolean;
  v_proof     text;
  v_status    public.user_status;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze rozpatrywac zgloszenia';
  end if;

  if p_approve is null then
    raise exception 'Brak decyzji: p_approve nie moze byc null';
  end if;

  if p_approve and p_team_id is null then
    raise exception 'Akceptacja wymaga wskazania druzyny';
  end if;

  select user_id, full_name, ksywka, rezerwa, proof_path
    into v_user_id, v_full_name, v_ksywka, v_rezerwa, v_proof
  from public.registrations
  where id = p_registration_id and status = 'pending'
  for update;

  if v_user_id is null then
    raise exception 'Zgloszenie nie istnieje albo zostalo juz rozpatrzone';
  end if;

  if p_approve and (v_rezerwa or v_proof is null) then
    raise exception 'Nie mozna przyjac: zgloszenie jest na rezerwie albo nie ma przelewu';
  end if;

  -- Limit drużyny (decyzja Mikołaja 2026-10-11: 6 drużyn po 9 osób).
  -- Liczą się przyjęci uczestnicy, nie Kadra (admini). Blokada wiersza
  -- drużyny: dwóch adminów przyjmujących naraz nie przepchnie dziesiątej osoby.
  if p_approve then
    perform 1 from public.teams where id = p_team_id for update;
    if (select count(*) from public.profiles
        where team_id = p_team_id and role <> 'admin' and status = 'approved'::public.user_status
          and id <> v_user_id)
       >= coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'druzyna_limit'), 9) then
      raise exception 'DRUZYNA_PELNA';
    end if;
  end if;

  v_status := (case when p_approve then 'approved' else 'rejected' end)::public.user_status;

  update public.registrations
  set status      = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_note
  where id = p_registration_id;

  update public.profiles
  set -- Odrzucenie nie degraduje osoby już przyjętej. zloz_zgloszenie
      -- odmawia zaakceptowanym, ale sprawdza to przed insertem: jeśli admin
      -- przyjmie pierwsze zgłoszenie w trakcie składania drugiego, drugie
      -- przejdzie, a jego odrzucenie wyrzuciłoby człowieka z drużyny.
      status  = case
                  when not p_approve and status = 'approved'::public.user_status then status
                  else v_status
                end,
      team_id = case when p_approve then p_team_id else team_id end,
      -- Nazwy ustawionej samodzielnie dalej nie nadpisujemy, a odrzucenie w
      -- ogóle nie dotyka display_name — ksywka staje się nazwą w apce dopiero
      -- przy przyjęciu tego konkretnego zgłoszenia.
      display_name = case
                       when p_approve then coalesce(display_name, v_ksywka, v_full_name)
                       else display_name
                     end
  where id = v_user_id;
end;
$$;

-- ---------- Zapisy o 11:55 ----------
update app_settings set value = '"2026-10-12T11:55:00+02:00"'::jsonb where key = 'odslona_zapisy';

-- Jednorazowe otwarcie tury: zadanie samo się wyrejestrowuje, żeby nie
-- odpaliło się za rok. Miejsca ustawiane razem z otwarciem - do tego czasu
-- admin może dowolnie testować na swojej puli.
select cron.schedule(
  'otwarcie-dzialaczy-1210',
  '55 9 12 10 *',
  $cron$
    update public.pule set otwarta = true, miejsca = 30 where klucz = 'dzialacze';
    select cron.unschedule('otwarcie-dzialaczy-1210');
  $cron$
);
