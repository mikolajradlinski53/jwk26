-- Daty wydarzenia i miejsce: właściciel zmienia je bez wdrożenia.
insert into app_settings (key, value) values
  ('data_jwk',        '"2026-10-23T18:00:00+02:00"'::jsonb),
  ('data_swiezakow',  '"2026-10-16T18:00:00+02:00"'::jsonb),
  ('miejsce_nazwa',   '"OW Zielone Wzgórze"'::jsonb),
  ('miejsce_adres',   '"Poznańska 5, 58-540 Karpacz"'::jsonb)
on conflict (key) do nothing;
