-- ============================================================
-- Sekta Wyjazdowa — ikony pozycji i urealnienie półki
-- ============================================================

-- ---------- Ikona jako kolumna ----------
-- Klucz kształtu, nie ścieżka SVG i nie mapa nazw w komponencie. Ta sama zasada
-- co `requires_target`: pozycja dołożona zapytaniem dostaje ikonę bez ruszania
-- kodu, a komponent nie musi wiedzieć, że „Kielich" to akurat kufel.
--
-- Nullowalna świadomie: brak klucza albo klucz nieznany komponentowi daje
-- neutralny znak, a nie puste miejsce ani błąd. Nowa pozycja bez ikony wygląda
-- więc skromnie, ale nigdy nie rozsypuje półki.
alter table shop_items add column ikona text;

update shop_items set ikona = 'butelka'  where name = 'Woda Święcona';
update shop_items set ikona = 'pizza'    where name = 'Manna';
update shop_items set ikona = 'skrzynka' where name = 'Napar Braterski';
update shop_items set ikona = 'wino'     where name = 'Krew Ofiarna';
update shop_items set ikona = 'kropla'   where name = 'Namaszczenie';
update shop_items set ikona = 'worek'    where name = 'Chleb Powszedni';
update shop_items set ikona = 'kufel'    where name = 'Kielich';
update shop_items set ikona = 'puszka'   where name = 'Eliksir Czuwania';
update shop_items set ikona = 'blask'    where name = 'Błogosławieństwo';
update shop_items set ikona = 'tarcza'   where name = 'Tarcza';
update shop_items set ikona = 'sztylet'  where name = 'Klątwa';

-- ---------- Urealnienie półki ----------
-- Pierwszy zasiew był policzony wyłącznie pod ekonomię punktów i wyszedł
-- odjechany po stronie **realnego** kosztu: sześciopak razy sześć sztuk to
-- trzydzieści sześć piw, które ktoś musi kupić z budżetu wyjazdu. Punkty są
-- darmowe, piwo nie.
--
-- Rzeczy drogie zostają na półce, ale jako nagroda rzadka — po jednej sztuce na
-- cały wyjazd. Tani koniec zostaje bez zmian, bo to on będzie klikany.
update shop_items set stock = 1 where name = 'Woda Święcona';
update shop_items set stock = 1 where name = 'Manna';
update shop_items set stock = 2 where name = 'Krew Ofiarna';

update shop_items
set description = 'Trzy piwa dla drużyny',
    price       = 110,
    stock       = 3
where name = 'Napar Braterski';
