-- ============================================================
-- Sekta Wyjazdowa — harmonogram
-- ============================================================
--
-- Zgłoszenie Mikołaja 2026-09-29: pod kontaktem w „Więcej” harmonogram —
-- dzień, godzina, co się dzieje i wolny opis. Edytowany w Sanktuarium.
-- Zwykła tabela z RLS zamiast funkcji: nie ma tu reguł ponad „czytają
-- przyjęci, pisze admin”, a panel robi proste insert/update/delete.

create table harmonogram (
  id         uuid primary key default gen_random_uuid(),
  dzien      date not null,
  -- Pusta godzina = punkt bez konkretnej pory („cały dzień”, „wieczorem”
  -- w opisie). Sortowana na początek dnia.
  godzina    time,
  tytul      text not null check (length(btrim(tytul)) between 1 and 80),
  opis       text check (opis is null or length(opis) <= 1000),
  created_at timestamptz not null default now()
);

create index harmonogram_kolejnosc on harmonogram (dzien, godzina nulls first);

alter table harmonogram enable row level security;

create policy harmonogram_read on harmonogram
  for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy harmonogram_admin_insert on harmonogram
  for insert to authenticated
  with check (public.is_admin());

create policy harmonogram_admin_update on harmonogram
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy harmonogram_admin_delete on harmonogram
  for delete to authenticated
  using (public.is_admin());

revoke all on harmonogram from anon;
revoke truncate, references, trigger on harmonogram from authenticated;
