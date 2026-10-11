-- ============================================================
-- Sekta Wyjazdowa — potwierdzenie przelewu także w PDF
-- ============================================================
--
-- Banki często dają potwierdzenie przelewu wyłącznie jako PDF (zgłoszenie
-- Mikołaja 2026-10-11). Bucket i ścieżka przyjmują teraz także .pdf; limit
-- 5 MB bez zmian. OCR czyta tylko obrazy - PDF admin ogląda sam.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'proofs';

create or replace function public.sciezka_dowodu_ok(p_sciezka text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_sciezka ~ (
    '^' || (select auth.uid())::text || '/[A-Za-z0-9_-]+\.(jpe?g|png|webp|pdf)$'
  );
$$;
revoke execute on function public.sciezka_dowodu_ok(text) from anon, public, authenticated;
