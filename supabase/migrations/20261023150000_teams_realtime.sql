-- Karta „Twoja drużyna” na żywo (2026-10-23): start głosowania, wybór kapitana
-- i nadanie nazwy to zmiany wiersza `teams`. Tabela czytelna dla wszystkich
-- (teams_read), więc zdarzenia dojdą do uczestników; głosy zostają tajne.
alter publication supabase_realtime add table public.teams;
