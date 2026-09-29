-- ============================================================
-- Sekta Wyjazdowa — landing: plan z harmonogramu (plan 16a)
-- ============================================================
--
-- Plan żyje w jednym miejscu. Landing pokazuje wyłącznie punkty, które admin
-- oznaczył „na landing” — reszta (w tym wszystko z motywem) zostaje w apce.

alter table harmonogram add column na_landingu boolean not null default false;

grant select (id, dzien, godzina, tytul, opis, na_landingu) on harmonogram to anon;

create policy harmonogram_read_public on harmonogram
  for select to anon
  using (na_landingu);

-- Szkic do podmiany przez właściciela po konsultacji z Zespołem. Tylko gdy
-- na landing nie ma jeszcze nic — ponowne zastosowanie nie zdubluje planu.
insert into harmonogram (dzien, godzina, tytul, opis, na_landingu)
select v.dzien::date, v.godzina::time, v.tytul, v.opis, true
from (values
  ('2026-10-23', '16:00', 'Zbiórka i wyjazd',         'Wyjeżdżamy autokarem spod uczelni. (szkic)'),
  ('2026-10-23', '19:00', 'Zakwaterowanie i kolacja', 'Rozlokowanie w pokojach, potem wspólna kolacja. (szkic)'),
  ('2026-10-23', '21:00', 'Wieczór integracyjny',     'Poznajemy się w drużynach. (szkic)'),
  ('2026-10-24', '09:00', 'Śniadanie',                null),
  ('2026-10-24', '10:00', 'Szkolenia w komisjach',    'Praca w komisjach i warsztaty. (szkic)'),
  ('2026-10-24', '13:30', 'Obiad',                    null),
  ('2026-10-24', '15:00', 'Gra terenowa',             'Rywalizacja drużyn w terenie — ubierz się ciepło. (szkic)'),
  ('2026-10-24', '21:00', 'Wieczór główny',           'Najważniejszy wieczór wyjazdu. (szkic)'),
  ('2026-10-25', '09:30', 'Śniadanie',                null),
  ('2026-10-25', '11:00', 'Podsumowanie wyjazdu',     'Wyniki drużyn i zdjęcie grupowe. (szkic)'),
  ('2026-10-25', '13:00', 'Powrót',                   'Wykwaterowanie i powrót autokarem. (szkic)')
) as v(dzien, godzina, tytul, opis)
where not exists (select 1 from harmonogram where na_landingu);
