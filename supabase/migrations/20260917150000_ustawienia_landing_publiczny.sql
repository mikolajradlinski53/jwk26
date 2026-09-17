-- Landing (`/`) czyta te ustawienia bez sesji — kluczem anon, nie authenticated.
-- Polityka `settings_read` z migracji init obejmuje wyłącznie `authenticated`,
-- więc anonimowy odczyt wraca z pustym zbiorem wierszy (RLS filtruje po cichu,
-- bez błędu), a `ustawienia()` w tej sytuacji degraduje do samych `null` —
-- licznik na landingu pokazywałby kreskę zamiast prawdziwych liczb.
--
-- Zawężone do czterech kluczy, które faktycznie trafiają na landing: progi
-- kasyna i RTP slotów zostają niewidoczne dla anonima.
create policy settings_read_public on app_settings
  for select to anon
  using (key in ('data_jwk', 'data_swiezakow', 'miejsce_nazwa', 'miejsce_adres'));
