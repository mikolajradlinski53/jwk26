-- Krótkie filmy w bingo, grze terenowej i postach (Mikołaj 2026-10-23).
-- Ten sam bucket i ta sama kolumna photo_path - film poznaje się po
-- rozszerzeniu (.mp4/.mov/.webm), okładka leży obok jako .podglad.jpg.
-- Limit pliku 50 MB = limit projektu; długość (30 s) pilnuje apka przy wyborze.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'],
    file_size_limit = 52428800
where id = 'bingo';

-- Okładka filmu to <plik bez rozszerzenia>.podglad.jpg, nie zamiana „.jpg” -
-- reguła chroniąca pliki pod zadaniami musi ją rozpoznawać tak samo.
drop policy bingo_posty_pliki_delete on storage.objects;
create policy bingo_posty_pliki_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bingo'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
    and not exists (
      select 1 from public.bingo_submissions s
      where s.task_id is not null
        and (s.photo_path = storage.objects.name
             or regexp_replace(s.photo_path, '\.[A-Za-z0-9]+$', '.podglad.jpg') = storage.objects.name)
    )
  );
