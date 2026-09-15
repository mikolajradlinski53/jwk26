-- ============================================================
-- Sekta Wyjazdowa — hartowanie bramy wejściowej
-- Poprawki z przeglądu migracji 0002.
-- ============================================================

-- ---------- Jedno zgłoszenie w toku na osobę ----------
-- Polityka INSERT pilnowała treści zgłoszenia, ale nie jego liczby: pętla
-- insertów z konsoli przeglądarki przechodziła w całości i zasypywała kolejkę
-- admina, w której każdy wiersz kosztuje osobne createSignedUrl.
create unique index registrations_one_pending_idx
  on registrations (user_id)
  where status = 'pending';

-- ---------- Ograniczenia na pola OCR ----------
-- Nie po to, żeby ufać klientowi — bramką jest człowiek (D4) — tylko żeby panel
-- admina nie wyświetlił „pewność 1e+32%" i żeby jedno zgłoszenie nie mogło
-- wepchnąć megabajta tekstu do bazy na darmowym planie.
alter table registrations
  add constraint registrations_ocr_confidence_zakres
    check (ocr_confidence is null or ocr_confidence between 0 and 1),
  add constraint registrations_ocr_keywords_zakres
    check (ocr_keywords_hit between 0 and 6),
  add constraint registrations_ocr_text_dlugosc
    check (ocr_text is null or length(ocr_text) <= 20000);

-- ---------- Szczelniejsza polityka wstawiania ----------
-- Dwie dziury w poprzedniej wersji:
--   1. `like 'uuid/%'` przepuszczał `uuid/../cudzy-uuid/plik.jpg`, a klient
--      Storage normalizuje `..` przy budowaniu URL-a — admin oglądałby cudzy
--      dowód przelewu podpisany nazwiskiem napastnika.
--   2. osoba już zaakceptowana mogła złożyć nowe zgłoszenie, a jego odrzucenie
--      zbijało jej profiles.status na 'rejected' i wyrzucało ją z aplikacji.
drop policy registrations_insert_own on registrations;

create policy registrations_insert_own on registrations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and proof_path like ((select auth.uid())::text || '/%')
    and proof_path !~ '\.\.'
    and not public.is_approved()
  );

-- ---------- Funkcja rozpatrująca: NULL to nie „odrzuć" ----------
-- Poprzednia wersja przy p_approve = null przechodziła oba warunki i po cichu
-- odrzucała zgłoszenie: `null and ...` daje null (gałąź else), a `case when null`
-- traktuje null jak fałsz. Literówka w panelu kosztowałaby kogoś wyjazd.
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
  v_status    public.user_status;
begin
  -- SECURITY DEFINER omija RLS, więc uprawnienie trzeba sprawdzić ręcznie.
  -- Bez tej linii dowolny zalogowany zaakceptowałby sam siebie jednym rpc().
  if not public.is_admin() then
    raise exception 'Tylko admin moze rozpatrywac zgloszenia';
  end if;

  if p_approve is null then
    raise exception 'Brak decyzji: p_approve nie moze byc null';
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

-- `revoke ... from public` z migracji 0002 nie zdejmuje jawnego grantu, który
-- Supabase nadaje roli anon przez alter default privileges na schemacie public.
revoke execute on function public.review_registration(uuid, boolean, uuid, text) from anon, public;
grant  execute on function public.review_registration(uuid, boolean, uuid, text) to authenticated;
