-- ============================================================================
-- Feed: swobodne posty ze zdjęciem (decyzja Mikołaja 2026-10-21)
-- ============================================================================
-- Post to wiersz bingo_submissions bez zadania (task_id NULL), od razu
-- `approved`: lajki, komentarze, stały adres zdjęcia i karta wpisu w feedzie
-- działają bez zmian. Bez punktów (review_bingo go nigdy nie dotyka) i bez
-- kolejki admina (ta bierze tylko `pending`). Moderacja po fakcie: autor i
-- admin usuwają post jednym kliknięciem.

alter table public.bingo_submissions alter column task_id drop not null;

-- Post nie czeka na akceptację - inaczej wisiałby w kolejce bingo bez zadania.
alter table public.bingo_submissions
  add constraint bingo_post_od_razu check (task_id is not null or status = 'approved'::public.user_status);

-- Dodanie: tylko przyjęty uczestnik, pod własnym nazwiskiem i drużyną, plik
-- we własnym folderze. Stara polityka (zgłoszenia do zadań) zostaje obok -
-- polityki INSERT sumują się, a tamta i tak wymaga istniejącego zadania.
create policy posty_insert_own on public.bingo_submissions
  for insert to authenticated
  with check (
    task_id is null
    and user_id = (select auth.uid())
    and public.is_approved()
    and team_id = (select p.team_id from public.profiles p where p.id = (select auth.uid()))
    and status = 'approved'::public.user_status
    and reviewed_by is null
    and reviewed_at is null
    and photo_path like (select auth.uid())::text || '/%'
    and photo_path !~ '\.\.'
  );

-- Usunięcie posta: autor albo admin. Lajki i komentarze idą kaskadą.
create policy posty_delete on public.bingo_submissions
  for delete to authenticated
  using (task_id is null and (user_id = (select auth.uid()) or public.is_admin()));

-- Pliki usuniętego posta: autor swoje, admin każde - ale nigdy zdjęcia, które
-- wisi pod zadaniem bingo albo gry (to jest dowód do punktów).
create policy bingo_posty_pliki_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bingo'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
    and not exists (
      select 1 from public.bingo_submissions s
      where s.task_id is not null
        and (s.photo_path = storage.objects.name
             or replace(s.photo_path, '.jpg', '.podglad.jpg') = storage.objects.name)
    )
  );

-- ---------- Limit przeciw zalewowi ----------
-- 30 postów na godzinę na osobę - dużo jak na zdjęcia z wyjazdu, mało jak na
-- pętlę albo zawieszony przycisk.
create or replace function public.posty_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id is null and (
    select count(*) from public.bingo_submissions
    where user_id = new.user_id and task_id is null and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'POSTY_LIMIT';
  end if;
  return new;
end;
$$;

revoke execute on function public.posty_limit() from public, anon, authenticated;

create trigger posty_limit
  before insert on public.bingo_submissions
  for each row execute function public.posty_limit();
