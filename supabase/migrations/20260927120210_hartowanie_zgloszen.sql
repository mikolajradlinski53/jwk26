-- ============================================================
-- Sekta Wyjazdowa — zapisy: hartowanie ścieżki dowodu
-- Poprawki z przeglądu migracji 20260927120200.
-- ============================================================

-- ---------- Ścieżka dowodu: lista dozwolonych znaków ----------
-- Poprzednia wersja odrzucała tylko dosłowne `..`. Parser URL w przeglądarce
-- traktuje też `%2e%2e`, `.%2e` i `%2e.` jak `..`, a storage-js nie koduje
-- ścieżki przy createSignedUrl — `<uid>/%2e%2e/<cudzy-uid>/plik.jpg`
-- przechodził i admin oglądałby cudzy dowód podpisany nazwiskiem zgłaszającego.
--
-- Zamiast wyliczać złe znaki, wymagamy dokładnego kształtu, który wysyła
-- src/lib/zapisy/przelew.ts: własny folder, jedna nazwa bez kropek
-- i ukośników, rozszerzenie obrazka. UUID z auth.uid() to wyłącznie cyfry
-- szesnastkowe i myślniki, więc wklejenie go do wyrażenia jest bezpieczne.
create or replace function public.sciezka_dowodu_ok(p_sciezka text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_sciezka ~ (
    '^' || (select auth.uid())::text || '/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$'
  );
$$;

-- `create or replace` zachowuje uprawnienia, ale powtarzamy revoke, żeby ten
-- plik czytany osobno mówił całą prawdę.
revoke execute on function public.sciezka_dowodu_ok(text) from anon, public, authenticated;

-- ---------- Wersja zgód: rozsądna długość ----------
-- Wersja to krótki identyfikator (dziś data), nie miejsce na dowolny tekst.
alter table registrations
  add constraint registrations_wersja_zgod_dlugosc
  check (wersja_zgod is null or length(wersja_zgod) <= 32);
