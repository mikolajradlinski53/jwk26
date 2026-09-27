-- ============================================================
-- Sekta Wyjazdowa — zapisy: rezerwa i akceptacja
-- ============================================================

-- ---------- Awans z rezerwy (D3) ----------
-- Ręczny: admin widzi wolne miejsce i kolejkę, klika. Automat musiałby
-- zgadywać, czy odrzucona osoba zaraz nie złoży poprawionego zgłoszenia.
create function public.awansuj_z_rezerwy(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pula    text;
  v_miejsca integer;
  v_zajete  integer;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze awansowac z rezerwy';
  end if;

  select pula into v_pula
  from public.registrations
  where id = p_registration_id
    and status = 'pending'::public.user_status
    and rezerwa;

  if v_pula is null then
    raise exception 'Zgloszenie nie czeka na rezerwie';
  end if;

  -- Ta sama blokada co w zloz_zgloszenie: awans i świeży zapis nie mogą
  -- naraz zająć ostatniego miejsca.
  select miejsca into v_miejsca from public.pule where klucz = v_pula for update;

  select count(*) into v_zajete
  from public.registrations
  where pula = v_pula
    and not rezerwa
    and status in ('pending'::public.user_status, 'approved'::public.user_status);

  if v_zajete >= v_miejsca then
    raise exception 'Brak wolnego miejsca w puli';
  end if;

  update public.registrations
  set rezerwa = false
  where id = p_registration_id
    and status = 'pending'::public.user_status
    and rezerwa;

  -- Między pierwszym odczytem a blokadą zgłoszenie mogło zostać rozpatrzone.
  if not found then
    raise exception 'Zgloszenie nie czeka na rezerwie';
  end if;
end;
$$;

revoke execute on function public.awansuj_z_rezerwy(uuid) from anon, public;
grant  execute on function public.awansuj_z_rezerwy(uuid) to authenticated;

-- ---------- Przelew po awansie ----------
-- Jedyna zmiana, jaką uczestnik może zrobić we własnym zgłoszeniu, i tylko
-- raz: warunek `proof_path is null` nie pozwoli podmienić dowodu po fakcie.
create function public.dolacz_przelew(
  p_proof_path       text,
  p_ocr_text         text    default null,
  p_ocr_confidence   real    default null,
  p_ocr_keywords_hit integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;

  if p_proof_path is null or not public.sciezka_dowodu_ok(p_proof_path) then
    raise exception 'Niepoprawna sciezka potwierdzenia przelewu';
  end if;

  update public.registrations
  set proof_path       = p_proof_path,
      ocr_text         = p_ocr_text,
      ocr_confidence   = p_ocr_confidence,
      ocr_keywords_hit = coalesce(p_ocr_keywords_hit, 0)
  where user_id = auth.uid()
    and status = 'pending'::public.user_status
    and not rezerwa
    and proof_path is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Brak zgloszenia czekajacego na przelew';
  end if;
end;
$$;

revoke execute on function public.dolacz_przelew(text, text, real, integer) from anon, public;
grant  execute on function public.dolacz_przelew(text, text, real, integer) to authenticated;

-- ---------- Rozpatrywanie: rezerwa, przelew, ksywka ----------
-- Pełna treść z hartowania bramy plus trzy zmiany:
--   1. przyjąć można tylko zgłoszenie na miejscu i ze zdjęciem przelewu;
--      odrzucić — każde, także rezerwowe (np. zła pula);
--   2. nazwa w apce to ksywka z identyfikatora (D11), a imię i nazwisko
--      tylko wtedy, gdy ksywki nie ma (zgłoszenia sprzed planu 08);
--   3. odrzucenie nie zdejmuje statusu 'approved' z profilu.
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
      -- Nazwy ustawionej samodzielnie dalej nie nadpisujemy.
      display_name = coalesce(display_name, v_ksywka, v_full_name)
  where id = v_user_id;
end;
$$;

revoke execute on function public.review_registration(uuid, boolean, uuid, text) from anon, public;
grant  execute on function public.review_registration(uuid, boolean, uuid, text) to authenticated;
