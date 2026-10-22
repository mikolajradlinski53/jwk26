-- Bingo: poprawione tytuły i opisy pól (Mikołaj 2026-10-22). Zasady i punkty
-- bez zmian; pole 12 dalej darmowe.
update public.bingo_tasks t
set title = v.title, description = v.description
from (values
  ( 0, '24h szotów',               'Jeden szot co godzinę przez jedną osobę z Kadry. Każde 24 udokumentowane.'),
  ( 1, 'Wieża z Sekty',            'Cała drużyna robi wieżę z ludzi.'),
  ( 2, 'Prank na Buczim',          'Robicie niespodziewanego pranka na Buczim.'),
  ( 3, 'Cała Sekta na budowie',    'Wszyscy na zdjęciu na imprezie.'),
  ( 4, 'Kocioł z kasku',           'Przygotujcie alko kociołek i wypijcie go z kasku budowlanego.'),
  ( 5, 'Fota z randomem',          'Zdjęcie z osobą spoza wyjazdu.'),
  ( 6, 'Alko dla Kadry',           'Wręczcie komuś z Kadry alkohol ;)'),
  ( 7, 'Protokół w minutę',        'Cała drużyna wali protokół z wódki w minutę.'),
  ( 8, 'Mem wyjazdu',              'Przygotujcie mema wyjazdu.'),
  ( 9, 'Zdjęcie pokoleniowe',      '5 różnych roczników na jednym zdjęciu.'),
  (10, 'Nowa fryzura',             'Jedna osoba z drużyny farbuje włosy albo goli łeb.'),
  (11, 'Bukiet dla Kadry',         'Po bukieciku dla każdej dziewczyny z Kadry.'),
  (12, 'Pole darmowe',             'Pole darmowe - zaliczone od startu.'),
  (13, 'Trading',                  'Wymień długopis na przedmiot o wartości wyższej niż 10 zł.'),
  (14, 'Ice bucket challenge',     'Min. jedna osoba bierze udział. Zimne wiadro wody na głowę.'),
  (15, 'Maskotka Sekty',           'Wykonajcie maskotkę Waszej drużyny z rzeczy znalezionych pod ręką.'),
  (16, 'Poderwij Radka',           'Radek musi się zarumienić :-)'),
  (17, 'Swap ubrań',               'Dwie osoby z drużyny różnej płci zamieniają się ubraniami.'),
  (18, 'Toast',                    'Wznieście drużynowy toast na śniadaniu lub obiadokolacji.'),
  (19, 'Udział w pub quizie',      'Większość drużyny wzięła udział.'),
  (20, 'Kiełbaska',                'Usmażcie dla kogoś z Kadry kiełbaskę z ogniska.'),
  (21, 'Cała Sekta na Lujku',      'Drużynowa fota z udziału.'),
  (22, 'Gołe dupy',                'Jak najwięcej gołych dup na jednym zdjęciu.'),
  (23, 'Cała Sekta na Topalkach',  'Fota całej drużyny z Topalek.'),
  (24, 'Fota z Kierownikiem Budowy', 'Drużynowa fota z Koordynatorem.')
) as v(position, title, description)
where t.rodzaj = 'bingo' and t.position = v.position;
