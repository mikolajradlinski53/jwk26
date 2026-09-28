# Kruk — spec projektowy

Data: 2026-09-28
Status: zatwierdzony do implementacji
Poprzedza: plan 14

## 1. Czym to jest

Gra zręcznościowa w arcade: czarny kruk przelatuje przez szczeliny między
kamiennymi kolumnami świątyni. Każde dotknięcie ekranu podrywa go w górę,
bez dotknięcia opada. Wynik to liczba minionych kolumn.

Pozycja 14 z mapy mechanizmów (`2026-09-28-mapa-mechanizmow-design.md`), tam
jeszcze pod nazwą „Dino". Mechanika zmieniła się z biegu z przeszkodami na lot
przez szczeliny (decyzja Mikołaja), więc zmieniła się też nazwa.

**Bez punktów — tylko ranking.** Gra nie dotyka księgi, salda ani limitu obrotu
kasyna. Wynik zgłasza niezaufany klient; da się go ograniczyć, nie zweryfikować.
Podrobiony wynik psuje najwyżej ranking kruka.

## 2. Zakres

**W zakresie:**

- tabela `kruk_gry` i dwie funkcje: `kruk_start()`, `kruk_wynik(p_gra, p_wynik)`
- sprawdzenie wyniku względem czasu od startu nadanego przez bazę
- widok `kruk_ranking` — najlepszy wynik każdej osoby
- ekran `/app/arcade/kruk`: plansza w canvasie, rekord i miejsce, top 10
- czysty moduł fizyki z testami

**Poza zakresem, świadomie:**

- **Punkty i wypłaty.** Gra umiejętnościowa z wynikiem od klienta nie może
  płacić, bez względu na sufit.
- **Ranking drużyn i ranking dnia.** Jedna tabela osób wystarcza (decyzja
  Mikołaja).
- **Powtórka ruchów na serwerze.** Chroniłaby przed tym, przed czym chroni już
  sprawdzenie czasu, a wymaga dwóch identycznych symulacji fizyki.
- **Tryb offline z kolejką wyników.** Bez sieci da się polatać, ale lot się
  nie zapisze. Spec główny (§11) dopuszczał offline dla tej gry; rezygnujemy,
  bo ośrodek ma Wi-Fi, a kolejka wyników otwiera furtkę na podrabianie czasu.
- **Dźwięk i dopracowana grafika** — plan 15.

## 3. Decyzje

**D1. Osobna tabela, nie `game_sessions`.** `game_sessions.stake` ma
`check (stake > 0)`, a `obrot_w_oknie` sumuje stawki wszystkich gier. Kruk nie
ma stawki; wciśnięcie go tam wymagałoby zmiany ograniczenia i pilnowania, żeby
nie liczył się do obrotu.

**D2. Start z serwera i sprawdzenie czasu.** Baza zapisuje moment startu;
wynik nie może przekroczyć tego, co da się przelecieć od tego momentu. Wysłanie
dowolnego wyniku z konsoli nie przejdzie; oszukać może tylko bot, który naprawdę
leci przez cały czas.

**D3. Stała prędkość.** Kolumny mijają kruka w stałym rytmie, więc limit
w bazie jest ciasny. Trudność daje rozrzut wysokości szczelin, nie
przyspieszanie — przy przyspieszaniu limit musiałby zakładać najwyższe tempo
i puszczałby dużo za dużo.

**D4. Gra startuje bez czekania na serwer.** Pierwsze dotknięcie woła
`kruk_start()` w tle i od razu puszcza lot. Czas liczy się od startu w bazie,
więc opóźnienie sieci działa wyłącznie na niekorzyść zgłaszającego.

## 4. Baza

### Tabela

```
kruk_gry
  id          uuid primary key default gen_random_uuid()
  user_id     uuid not null references profiles(id) on delete cascade
  started_at  timestamptz not null default now()
  wynik       integer            -- null, dopóki gra trwa
  finished_at timestamptz
```

RLS włączone, brak polityk i grantów dla `anon` i `authenticated`. Jedyne
wejście to funkcje `security definer` z `set search_path = ''`.

### `kruk_start() returns uuid`

1. `auth.uid()` jest ustawione, inaczej `Brak sesji`.
2. Profil ma status `approved`, inaczej `Tylko zaakceptowani uczestnicy moga grac`.
3. Usuwa niedokończoną grę tej osoby (`wynik is null`). Każdy ma najwyżej
   jedną otwartą grę; porzucone starty nie zostają w tabeli.
4. Wstawia nowy wiersz, zwraca `id`.

### `kruk_wynik(p_gra uuid, p_wynik integer) returns integer`

Blokuje wiersz gry (`for update`) i sprawdza kolejno:

1. Gra istnieje i należy do `auth.uid()`, inaczej `Nie ma takiej gry`.
2. `wynik is null`, inaczej `Wynik tej gry jest juz zapisany`.
3. `p_wynik >= 0`, inaczej `Wynik nie moze byc ujemny`.
4. `p_wynik <= floor(sekundy_od_startu / ODSTEP_KOLUMN_S) + 1`, inaczej
   `Wynik niemozliwy w tym czasie`.

`ODSTEP_KOLUMN_S` to stała w ciele funkcji z komentarzem wskazującym stałą
w `src/lib/kruk/fizyka.ts`. Zapisuje `wynik` i `finished_at = now()`, zwraca
najlepszy wynik osoby po tej grze.

### Widok `kruk_ranking`

Prawami właściciela (jak `moje_spiny`), bo gracz nie ma grantu na tabelę.
Kolumny: `user_id`, `display_name`, `team_id`, `color`, `rekord`, `miejsce`
(`rank()` po rekordzie malejąco). Tylko osoby ze statusem `approved` i co
najmniej jednym zapisanym wynikiem. `grant select` dla `authenticated`.

## 5. Ekran i gra

### Kod

- `src/lib/kruk/fizyka.ts` — czysta logika, bez rysowania i bez Reacta:
  stałe (grawitacja, siła machnięcia, prędkość pozioma, `ODSTEP_KOLUMN_S`,
  szerokość szczeliny, zakres jej wysokości), typ stanu, `nowyStan()`,
  `krok(stan, dt, machniecie)`, kolizje, licznik minionych kolumn. Losowanie
  wysokości szczelin przez wstrzykiwaną funkcję (testy podają ustaloną).
  Świat w jednostkach logicznych 360 × 480 — zachowuje się tak samo na każdym
  ekranie.
- `src/app/app/arcade/kruk/page.tsx` — komponent serwerowy: rekord i miejsce
  osoby, top 10 z `kruk_ranking`.
- `src/app/app/arcade/kruk/Lot.tsx` — komponent kliencki: canvas skalowany pod
  `devicePixelRatio`, pętla `requestAnimationFrame` ze stałym krokiem fizyki
  60 Hz (nadmiar czasu przechodzi do następnej klatki, krok przycięty do
  250 ms), rysowanie ze stanu.
- Odnośnik w `/app/arcade`, obok blackjacka: „Kruk · ranking →".

### Sterowanie

Dotknięcie planszy (`pointerdown`) to machnięcie; spacja na komputerze.
Canvas ma `touch-action: none`, żeby dotknięcie nie przewijało ani nie
powiększało strony.

### Przebieg

1. **Czeka** — kruk unosi się w miejscu, napis „Dotknij, by lecieć".
2. **Pierwsze dotknięcie** — `kruk_start()` w tle, lot rusza od razu (D4).
3. **Lot** — kolumny w stałych odstępach, szczeliny na losowej wysokości,
   punkt za każdą minioną kolumnę.
4. **Rozbicie** o kolumnę, sufit albo ziemię — `kruk_wynik`, potem „Wynik N ·
   rekord M" i przycisk „Jeszcze raz"; ranking pod planszą się odświeża.

### Przypadki brzegowe

- **Wyjście z apki w trakcie lotu:** `visibilitychange` → pauza, wznowienie
  dotknięciem. Pauza nie pomaga oszukiwać — zegar w bazie biegnie dalej.
- **Brak sieci przy starcie:** gra działa, nad planszą „Brak połączenia — ten
  lot się nie zapisze"; wynik nie jest wysyłany.
- **Odrzucony wynik:** komunikat z bazy przez `src/lib/zapisy/bledy.ts`, jak
  w pozostałych grach.

### Wygląd

Sylwetka kruka jako prosty kształt, kolumny jako prostokąty z kapitelem,
kolory z istniejących tokenów (kość, dym na ciemnym tle). Surowo, jak reszta
`/app` — dopracowanie w planie 15.

## 6. Testy

**Baza** — `tests/db/kruk.test.ts`, przeciw `jwk26_test`:

- przyjęty uczestnik startuje i zgłasza wynik mieszczący się w czasie; wynik
  jest w rankingu;
- wynik za szybki na czas od startu jest odrzucany (test cofa `started_at`
  kluczem serwisowym, jak test porzuconej ręki w blackjacku);
- drugie zgłoszenie tej samej gry, zgłoszenie do cudzej gry i wynik ujemny
  odpadają;
- nieprzyjęty uczestnik nie wystartuje;
- nowy start usuwa niedokończoną grę;
- ranking pokazuje najlepszy wynik osoby, nie ostatni;
- gracz nie odczyta `kruk_gry` ani nic do niej nie wpisze bezpośrednio.

**Fizyka** — `tests/kruk-fizyka.test.ts`, bez sieci:

- machnięcie podrywa kruka, bez machnięcia opada;
- kolizja z kolumną, sufitem i ziemią kończy lot;
- przelot przez szczelinę dolicza dokładnie jeden punkt;
- `ODSTEP_KOLUMN_S` z `fizyka.ts` równa się stałej w najnowszej migracji
  kruka (test czyta plik migracji) — rozjazd wywala test.

Rysowanie i sterowanie: ręcznie w przeglądarce; na telefonie razem
z weryfikacją kasyna.
