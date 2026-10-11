-- ============================================================
-- Sekta Wyjazdowa — zapisy przez /wejscie od 11:45, Toplakyyy, poker 10
-- ============================================================
--
-- Decyzje Mikołaja 2026-10-12 (noc przed zapisami):
-- 1. Tura Działaczy otwiera się o 11:45 (osoby z linkiem do /wejscie
--    zapisują się wcześniej), a przycisk na stronie głównej odsłania się
--    jak dotąd o 11:55 (`odslona_zapisy` bez zmian). pg_cron liczy w GMT:
--    11:45 CEST = 09:45.
-- 2. „Topalki” nazywają się „Toplakyyy”.
-- 3. Poker: 10 miejsc.

select cron.unschedule('otwarcie-dzialaczy-1210')
where exists (select 1 from cron.job where jobname = 'otwarcie-dzialaczy-1210');

select cron.schedule(
  'otwarcie-dzialaczy-1210',
  '45 9 12 10 *',
  $cron$
    update public.pule set otwarta = true, miejsca = 30 where klucz = 'dzialacze';
    select cron.unschedule('otwarcie-dzialaczy-1210');
  $cron$
);

update zawody set nazwa = 'Toplakyyy' where nazwa = 'Topalki';
update zawody set limit_miejsc = 10 where nazwa = 'Poker';
