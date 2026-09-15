-- ============================================================
-- Sekta Wyjazdowa — brama wejściowa
-- ============================================================

-- ---------- Zgłoszenia ----------
-- Status celowo używa typu user_status z migracji 0001: wartości są identyczne
-- ('pending' | 'approved' | 'rejected'), a drugi enum o tych samych etykietach
-- byłby wyłącznie okazją do pomyłki przy rzutowaniu.
create table registrations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  full_name         text not null,
  phone             text,
  sms_consent       boolean not null default false,
  diet_notes        text,
  proof_path        text not null,
  -- Pola ocr_* pochodzą od niezaufanego klienta i to jest w porządku: decyzja D4
  -- mówi, że OCR jest podpowiedzią, a bramką jest człowiek patrzący na oryginał.
  ocr_text          text,
  ocr_confidence    real,
  ocr_keywords_hit  integer not null default 0,
  status            user_status not null default 'pending',
  reviewed_by       uuid references profiles(id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now()
);

create index registrations_user_idx   on registrations (user_id, created_at desc);
create index registrations_status_idx on registrations (status, created_at desc);

-- ---------- RLS zgłoszeń ----------
alter table registrations enable row level security;

create policy registrations_read_own on registrations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Świeże zgłoszenie musi być własne, czekające i wskazywać na plik we własnym
-- folderze. Bez ostatniego warunku uczestnik podpiąłby pod swoje zgłoszenie
-- ścieżkę do cudzego dowodu przelewu i zobaczyłby go oczami admina.
create policy registrations_insert_own on registrations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and proof_path like ((select auth.uid())::text || '/%')
  );

-- Brak polityk UPDATE i DELETE jest zamierzony: status zmienia wyłącznie
-- review_registration. Admin też nie rusza tej tabeli zwykłym UPDATE-em.

-- ---------- Rozpatrywanie zgłoszeń ----------
-- Jedyna droga, którą profiles.status i profiles.team_id mogą się zmienić —
-- granty kolumnowe z migracji 0001 zabraniają tego nawet adminowi.
create function public.review_registration(
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
  v_status    public.user_status;
begin
  -- SECURITY DEFINER omija RLS, więc uprawnienie trzeba sprawdzić ręcznie.
  -- Bez tej linii dowolny zalogowany zaakceptowałby sam siebie jednym rpc().
  if not public.is_admin() then
    raise exception 'Tylko admin moze rozpatrywac zgloszenia';
  end if;

  if p_approve and p_team_id is null then
    raise exception 'Akceptacja wymaga wskazania druzyny';
  end if;

  select user_id, full_name into v_user_id, v_full_name
  from public.registrations
  where id = p_registration_id and status = 'pending'
  for update;

  if v_user_id is null then
    raise exception 'Zgloszenie nie istnieje albo zostalo juz rozpatrzone';
  end if;

  -- Rzutowanie jawne: przy search_path = '' nie ma po co liczyć na to, że
  -- literał sam trafi na właściwy typ.
  v_status := (case when p_approve then 'approved' else 'rejected' end)::public.user_status;

  update public.registrations
  set status      = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_note
  where id = p_registration_id;

  update public.profiles
  set status  = v_status,
      team_id = case when p_approve then p_team_id else team_id end,
      -- Nie nadpisujemy nazwy, którą ktoś zdążył sobie ustawić samodzielnie.
      display_name = coalesce(display_name, v_full_name)
  where id = v_user_id;
end;
$$;

revoke execute on function public.review_registration(uuid, boolean, uuid, text) from public;
grant  execute on function public.review_registration(uuid, boolean, uuid, text) to authenticated;

-- ---------- Bucket na dowody przelewu ----------
-- Bucket prywatny: dostęp wyłącznie przez podpisane URL-e generowane adminowi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Wrzucać wolno wyłącznie do folderu o nazwie własnego identyfikatora.
create policy proofs_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Czytać może wyłącznie admin — to dane finansowe. Autor zgłoszenia też nie,
-- bo swoje zdjęcie widział przed wysłaniem i nie ma po co wracać.
create policy proofs_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs' and public.is_admin());
