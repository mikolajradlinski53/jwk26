-- ============================================================
-- Sekta Wyjazdowa — zapisy: ksywka tylko przy przyjęciu
-- ============================================================

-- ---------- Rozpatrywanie: rezerwa, przelew, ksywka ----------
-- Kopia wersji z 20260927120300 z jedną zmianą: odrzucenie nie nadaje już
-- ksywki. `coalesce(display_name, v_ksywka, v_full_name)` działał też przy
-- p_approve = false — ksywka z odrzuconego zgłoszenia zostawała w profilu na
-- stałe i blokowała coalesce kolejnemu, przyjętemu zgłoszeniu tej samej osoby
-- (D11: nazwa w apce ma pochodzić z tego zgłoszenia, które faktycznie przeszło).
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

revoke execute on function public.review_registration(uuid, boolean, uuid, text) from anon, public;
grant  execute on function public.review_registration(uuid, boolean, uuid, text) to authenticated;
