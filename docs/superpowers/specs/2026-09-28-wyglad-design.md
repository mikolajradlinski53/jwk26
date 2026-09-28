# Wygląd — spec projektowy

Data: 2026-09-28
Status: zatwierdzony do implementacji
Poprzedza: plan 15

## 1. Czym to jest

Jeden przebieg po wyglądzie całej apki po tym, jak wszystkie mechanizmy (plany
09–14) są na produkcji. Kierunek ze speca frontu (`2026-09-16-front-po-zalogowaniu-design.md`)
zostaje: ciemne szkło, krew, Bodoni tylko duży. Ten plan dokłada **prawdziwe
grafiki** (wygenerowane w Higgsfieldzie), porządkuje kasyno i „Więcej”, daje
charakter pustym stanom, logowaniu i grom, przerabia ekrany admina i kończy się
przeglądem każdego ekranu w przeglądarce.

Przegląd zrzutów przed tym planem znalazł błąd, który uniemożliwiał korzystanie
z bingo (zamknięty `<dialog>` z klasą `flex` zasłaniał planszę; naprawione
w `34902fc`). Dlatego przegląd w przeglądarce jest częścią planu, a nie
dodatkiem.

## 2. Zakres

**W zakresie:**

- tło całej apki z obrazu (Dym) zamiast trzech gradientów
- ryciny w sześciu pustych stanach uczestnika i komponent `Pusto`
- kasyno jako rozdroże z trzema kaflami; sloty pod `/app/arcade/sloty`
- „Więcej” z ikonami i opisami
- kruk: tło, kolumny, sprite w 6 klatkach, kolizja z kapitelem
- blackjack: karty w szkle; sloty: bębny w sylwetce
- logowanie (`/wejscie`) z godłem
- przebieg po wszystkich ekranach admina
- przegląd każdego ekranu w Chrome w widoku telefonu, z poprawkami

**Poza zakresem, świadomie:**

- **Landing** (`/`) — ma własną, jesienną oprawę; nie ruszamy.
- **Grafiki pozycji sklepiku** — zostają ikony liniowe.
- Animacje przejść między ekranami, dźwięk.
- Zmiany w bazie — plan nie ma migracji.

## 3. Decyzje

**D1. Grafiki z Higgsfielda, obróbka lokalnie.** Generacje w Nano Banana Pro
(2 kredyty za obraz). Wycięcie tła w Higgsfieldzie (1 kredyt) tylko tam, gdzie
kolor tła myli się z obiektem (kruk). Poza tym obróbka lokalnie w Chrome:
kluczowanie jednolitej szarości (kolumna) i zamiana czerni na przezroczystość
(ryciny, godło). Na makiety i próby zeszło 26 kredytów ze 270.

**D2. Ryciny na przezroczystości, nie `mix-blend-mode`.** Szkło ma
`backdrop-filter`, który izoluje warstwę — `mix-blend-mode: screen` wewnątrz
szklanej karty nie widzi tła i czarny prostokąt zostaje. Czerń zamieniona na
kanał alfa przy obróbce działa w każdym kontekście.

**D3. Tło apki to Dym, tło gry to Nawa.** Dym (łuki, dym, poświaty w rogach)
jest spokojny pod szkłem i tekstem — wybór Mikołaja. Nawa (katedra, świece)
była drugą propozycją tła apki; jako tło gry kruka kosztuje 0 kredytów
i pasuje do kolumn.

**D4. Kruk: 6 klatek z przenikaniem, 120 ms na klatkę.** Dwa arkusze póz
(drugi z pierwszym jako referencją). Model trzymał się referencji, więc realnie
są 4 fazy skrzydeł i 2 warianty dołu. Cykl `1 → 6 → 2 → 3 → 5 → 2 → 6`
z przenikaniem sąsiednich klatek; 75 ms było za szybko (uwaga Mikołaja).

**D5. Kolizja obejmuje kapitel.** Kapitel wystaje poza trzon; bez tego kruk
przelatywałby przez widoczny kamień. Rytm kolumn się nie zmienia, więc limit
w `kruk_wynik()` zostaje.

**D6. Karty w szkle, sloty w sylwetce.** Z porównania trzech kierunków
Mikołaj wybrał szkło dla kart i sylwetkę dla bębnów.

**D7. Budżet wagi: 400 KB na wszystkie grafiki.** Tło apki (~9 KB) ładuje się
wszędzie; grafiki kruka tylko na jego ekranie; ryciny tylko tam, gdzie jest
pusty stan.

## 4. Grafiki

Wszystkie w `public/grafika/`, WebP.

| Plik | Źródło (Higgsfield, job) | Obróbka | Rozmiar docelowy |
|---|---|---|---|
| `tlo-apki.webp` | `62ed825b-da9c-432e-b5c4-d7ce1ec37048` (Dym) | skala 900 px, jakość 0,7 | ~9 KB |
| `kruk/tlo.webp` | `3e8244a9-9241-4ef0-9fe3-c293e7bac14b` (Nawa) | skala 720 px, jakość 0,72 | ~22 KB |
| `kruk/kolumna.webp` | `70d9fbcd-cff5-4f82-aa1b-da2db79d5b2a` | kluczowanie szarości, przycięcie do szerokości, 160 px | ~16 KB |
| `kruk/klatka-1…6.webp` | arkusze `a79aeb34-…` i `17a803ff-…`, wycięte `3940cb14-…`, `7ff2f288-…` | cięcie po pustych kolumnach, wyrównanie do czubka dzioba, 480 × 475 | ~35 KB każda |
| `puste/pioro.webp` | `1c284b9b-d015-4ba7-bd8f-98b3c9fe037b` | czerń → alfa, 320 px | ~10 KB |
| `puste/oko.webp` | `8eb9178f-6011-4fa9-aac5-1afbdb4b150d` | jw. | ~24 KB |
| `puste/list.webp` | `200dbfa7-0d41-44f4-9239-c5b48a92e715` | jw. | ~24 KB |
| `puste/kielich.webp` | `dc422b5c-e8ae-4878-8430-ac0e72c38602` | jw. | ~17 KB |
| `puste/swieca.webp` | `88fbce4d-0d31-4b5b-8c66-9be93ad908fc` | jw. | ~6 KB |
| `puste/karty.webp` | `2d561c93-89b0-4912-88b1-a127f7f73fcc` | jw. | ~26 KB |
| `godlo.webp` | `7a4c6ddf-134b-4d21-b0d8-3ee3e6040350` | czerń → alfa, 400 px, jakość 0,75 | ≤ 80 KB |

Prompty i pełne adresy wyników leżą w projekcie Higgsfielda „JWK26 — oprawa
wizualna”. Oryginały PNG (2–7 MB) nie trafiają do repo.

Skrypty obróbki (cięcie klatek, czerń → alfa, kluczowanie, kompresja) trafiają
do `scripts/grafika/` jako jednorazowe narzędzia z komentarzem, jak ich użyć —
żeby dało się podmienić grafikę bez odtwarzania całej rozmowy. Wymagają
`playwright-core` i Chrome; nie są zależnością projektu (instalacja
`--prefix` do katalogu tymczasowego, instrukcja w nagłówku skryptu).

## 5. Ekrany

### Tło apki

W `src/app/layout.tsx` warstwa `fixed` z trzema gradientami dostaje obraz
`tlo-apki.webp` (`background: var(--color-noc) url(...) center/cover`) —
ta sama warstwa, ta sama rola (to ją rozmywa szkło). Nie `background-attachment:
fixed` (iOS go ignoruje). Obraz dostaje preload. Kolor `--noc` pod spodem
sprawia, że przed wczytaniem ekran wygląda jak dziś, tylko ciemniej.

Landing ma własne tło; przy wdrożeniu trzeba sprawdzić, że go zakrywa. Jeśli
warstwa prześwituje na landingu, obraz dostaje tylko powłoka `/app` i ekrany
gościa (`/wejscie`, `/regulamin`).

### Puste stany — komponent `Pusto`

`src/components/Pusto.tsx`: `rycina?: "oko" | "list" | "kielich" | "swieca" |
"karty" | "pioro"`, `children` (tekst). Szklana karta, rycina 112 px nad tekstem,
`alt=""`. Bez `rycina` — sama karta z tekstem (admin).

| Ekran | Rycina | Tekst (bez zmian) |
|---|---|---|
| Feed | oko | Tu wylądują zdjęcia z bingo… |
| Gossipy | list | Jeszcze nic. Pierwsza kategoria… |
| Kronika sklepiku | kielich | Nikt jeszcze niczego nie kupił. |
| Sloty — historia | swieca | Jeszcze żadnego spinu. |
| Blackjack — historia | karty | Jeszcze żadnego rozdania. |
| Kruk — ranking | pioro | Nikt jeszcze nie przeleciał… |

### Kasyno

`/app/arcade` — saldo i trzy równorzędne kafle (link, grafika, nazwa, podpis):

- **Sloty** → `/app/arcade/sloty`, rycina świecy, „stawka 10 · limit dzienny”
- **Blackjack** → `/app/arcade/blackjack`, rycina kart, „stawka 10 · 20 · 50”
- **Kruk** → `/app/arcade/kruk`, klatka 1 kruka, „ranking, bez punktów”

Sloty (bębny, obrót, historia) przenoszą się bez zmian logiki do
`/app/arcade/sloty`. Blackjack i kruk wracają do kasyna jak dziś.

### „Więcej”

Pozycje Sanktuarium (admin), Kasyno, Gossipy dostają ikonę liniową (styl paska
nawigacji) i opis: „Panel organizatora”, „Sloty, blackjack i kruk”, „Anonimowe
głosowania”.

### Kruk

- `rysuj.ts`: tło (Nawa, `cover`, przyciemnione o ~25%), kolumny z grafiki
  (kapitel o stałej wysokości — górne 20% obrazu — i trzon rozciągany do
  potrzebnej długości; górna kolumna to odbicie w pionie), sprite z przenikaniem
  klatek (D4), pochylenie wg prędkości jak dziś.
- Szerokość trzonu w grafice = `SZER_KOLUMNY`; obraz rysowany szerzej
  (trzon to ~65% szerokości obrazka).
- `Lot.tsx` wczytuje obrazy przy montowaniu. Do czasu wczytania rysuje obecną
  wersję wektorową — słaba sieć niczego nie blokuje.
- `fizyka.ts`: kolizja z prostokątem kapitelu na końcu każdej kolumny od strony
  szczeliny (wymiary z grafiki, w jednostkach świata). Rytm kolumn bez zmian.

### Blackjack i sloty

- **Karta** (`Stol.tsx`): szklana tafla z blaskiem od góry, ranga w Bodoni,
  kier/karo w `krew-jasna`, pik/trefl w kości. Zakryta karta — ta sama tafla
  z ornamentem zamiast rangi.
- **Bębny** (`Bebny.tsx`, `Symbole.tsx`): pole czarne z czerwoną poświatą od
  środka, symbole wypełnione kością, oko z krwistą źrenicą. Kształty bez zmian.

### Logowanie

`/wejscie` — pionowo wyśrodkowane: godło (~184 px), „Wstąp do Sekty”, wiersz
„Jesienny Wyjazd Komisji · <data>” (data z `app_settings.data_jwk`, jeśli
gość może ją odczytać — inaczej wiersz bez daty), szklana ramka „Wejście tylko
dla Samorządu. Zaloguj się kontem Google w domenie **samorzad.ue.wroc.pl**”,
przycisk Google z logo „G”. Na dole: „Nie mogę się zalogować” (furtka z kodem —
logika bez zmian) i „Regulamin”. Stany odmowy, oczekiwania na Google, kodu
i limitu wysyłki zostają.

### Admin

- Sanktuarium: ikony przy pozycjach.
- Wspólne nagłówki sekcji i odstępy na ekranach list i formularzy.
- Szerokie tabele (Uczestnicy) przewijają się w poziomie wewnątrz ramki,
  nie całą stroną.
- `Pusto` bez ryciny zamiast ręcznych ramek.
- Logika i uprawnienia bez zmian.

## 6. Przegląd ekranów

Po wdrożeniu grafik każdy ekran uczestnika i admina w Chrome, 390 × 844,
dotyk, na bazie testowej, kontem testowym z rolą admina i punktami. Sprawdzane
automatycznie:

- element pod palcem w kilku punktach ekranu to treść, nie niewidoczna nakładka;
- brak błędów w konsoli;
- brak poziomego przewijania strony (`scrollWidth ≤ clientWidth`);
- cele dotykowe ≥ 44 px.

Ręcznie, na zrzutach: czytelność tekstu na nowym tle. Klikane ścieżki: arkusz
bingo, zakup w sklepiku, głos w gossipach, rozdanie w blackjacku, spin, lot
kruka, logowanie (bez sesji). Każdy znaleziony błąd — poprawka w tym planie,
osobnym commitem.

## 7. Testy

Wyglądu nie testujemy automatycznie (jak w specu z 16.09). Nowy test: kolizja
kruka z kapitelem (`tests/kruk-fizyka.test.ts`). Pełny zestaw, lint i build
muszą przechodzić.

## 8. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Szkło na obrazie tnie płynność na słabszych telefonach | Obraz jest jeden i statyczny; blur liczy się z niego tak samo jak z gradientów. Sprawdzenie na telefonie przy weryfikacji kasyna |
| Tekst nieczytelny na jaśniejszych miejscach tła | Przegląd zrzutów (§6); w razie potrzeby przyciemnienie warstwy |
| Grafiki kruka nie wczytają się przy słabym zasięgu | Wektorowy zapas do czasu wczytania |
| Klatki kruka przeskakują przy przenikaniu | Wyrównanie do czubka dzioba; wolniejszy cykl (D4) |
