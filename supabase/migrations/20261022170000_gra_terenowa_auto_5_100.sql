-- Gra terenowa (Mikołaj 2026-10-22): automatycznie liczy się zwykła wersja -
-- 5 pkt za stację i 100 za pełną trasę. Wersję „cała drużyna” (10 / 150)
-- przyznaje Kadra ręcznie dopłatą z panelu punktów.
update public.bingo_tasks set points = 5 where rodzaj = 'quest';
update public.app_settings set value = '100'::jsonb where key = 'gra_bonus_trasa';
