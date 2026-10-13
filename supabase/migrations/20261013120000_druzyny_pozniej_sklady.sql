-- ============================================================
-- Sekta Wyjazdowa — przyjęcie bez drużyny, przydział później; składy zawodów
-- ============================================================
--
-- Decyzje Mikołaja 2026-10-13:
-- 1. Zgłoszenia przyjmujemy od razu, a do drużyn ludzi rozdzielamy dopiero
--    po turze Świeżaków: review_registration przyjmuje p_team_id = NULL;
--    przydziel_druzyne (jedna osoba, też przeniesienie) i rozdziel_bez_druzyny
--    (wszyscy bez drużyny, po równo, z limitem). Uczestnik bez drużyny i tak
--    widzi poczekalnię do otwarcia platformy.
-- 2. Toplakyyy: składy po 4 osoby; siatkówka: po 6.

-- Kopia review_registration z 20261011190000: drużyna opcjonalna.
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

  -- Drużyna jest opcjonalna (2026-10-13): przyjmujemy od razu, a drużyny
  -- rozdziela się po turze Świeżaków (przydziel_druzyne / rozdziel_bez_druzyny).

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
  if p_approve and p_team_id is not null then
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

-- ---------- Przydział jednej osoby ----------
-- Też przeniesienie i zdjęcie z drużyny (p_team = NULL). Limit jak przy
-- akceptacji; kapitan, który zmienia drużynę, przestaje być kapitanem starej.
create function public.przydziel_druzyne(p_user uuid, p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stara uuid;
  v_limit integer := coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'druzyna_limit'), 9);
begin
  if not public.is_admin() then raise exception 'Tylko admin przydziela drużyny'; end if;

  select team_id into v_stara from public.profiles
  where id = p_user and status = 'approved'::public.user_status
  for update;
  if not found then raise exception 'Przydzielać można tylko przyjętych uczestników'; end if;
  if v_stara is not distinct from p_team then return; end if;

  if p_team is not null then
    perform 1 from public.teams where id = p_team for update;
    if not found then raise exception 'Nie ma takiej drużyny'; end if;
    if (select count(*) from public.profiles
        where team_id = p_team and role <> 'admin' and status = 'approved'::public.user_status)
       >= v_limit
       and (select role from public.profiles where id = p_user) <> 'admin' then
      raise exception 'DRUZYNA_PELNA';
    end if;
  end if;

  update public.profiles set team_id = p_team where id = p_user;
  update public.teams set captain_id = null where id = v_stara and captain_id = p_user;
end;
$$;
revoke execute on function public.przydziel_druzyne(uuid, uuid) from public, anon;
grant execute on function public.przydziel_druzyne(uuid, uuid) to authenticated;

-- ---------- Rozdzielenie wszystkich bez drużyny ----------
-- Losowa kolejność osób, każda do najmniej licznej drużyny z wolnym miejscem
-- (remis: niższy numer). Kadra pomijana - adminów przypisuje się ręcznie.
create function public.rozdziel_bez_druzyny()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'druzyna_limit'), 9);
  v_osoba uuid;
  v_team  uuid;
  v_ile   integer := 0;
  v_bez   integer := 0;
begin
  if not public.is_admin() then raise exception 'Tylko admin przydziela drużyny'; end if;
  perform 1 from public.teams for update;

  for v_osoba in
    select id from public.profiles
    where status = 'approved'::public.user_status and role <> 'admin' and team_id is null
    order by random()
  loop
    select t.id into v_team
    from public.teams t
    left join public.profiles p
      on p.team_id = t.id and p.role <> 'admin' and p.status = 'approved'::public.user_status
    group by t.id, t.numer
    having count(p.id) < v_limit
    order by count(p.id), t.numer
    limit 1;

    if v_team is null then
      v_bez := v_bez + 1;
    else
      update public.profiles set team_id = v_team where id = v_osoba;
      v_ile := v_ile + 1;
    end if;
  end loop;

  return jsonb_build_object('przydzielono', v_ile, 'bez_miejsca', v_bez);
end;
$$;
revoke execute on function public.rozdziel_bez_druzyny() from public, anon;
grant execute on function public.rozdziel_bez_druzyny() to authenticated;

-- ---------- Składy zawodów ----------
update zawody set rozmiar_skladu = 4,
  opis = 'Crème de la crème wyjazdu. Czteroosobowe składy, w każdym co najmniej jedna dziewczyna.'
where nazwa = 'Toplakyyy';
update zawody set rozmiar_skladu = 6, opis = 'Sześcioosobowe składy, każdy z każdym.'
where nazwa = 'Siatkówka';
