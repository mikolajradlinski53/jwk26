-- Punkty bingo i gry terenowej razy 3 (Mikołaj 2026-10-22).
-- Bingo: pole 60, wygrana 300, kumulacja 600.
-- Gra terenowa: stacja 15, pełna trasa 300 (cała drużyna 30 / 450 - dopłata Kadry).
update public.bingo_tasks set points = 60 where rodzaj = 'bingo';
update public.bingo_tasks set points = 15 where rodzaj = 'quest';
update public.app_settings set value = '300'::jsonb where key = 'bingo_bonus_wygrana';
update public.app_settings set value = '600'::jsonb where key = 'bingo_bonus_plansza';
update public.app_settings set value = '300'::jsonb where key = 'gra_bonus_trasa';
