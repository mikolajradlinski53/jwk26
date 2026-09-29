# Wygląd (15a) — spec projektowy

Data: 2026-09-28, zmieniony 2026-09-29
Status: zatwierdzony do implementacji
Poprzedza: plan 15a. Siostrzany: `2026-09-29-porzadek-design.md` (plan 15b).

## 1. Czym to jest

Jeden przebieg po wyglądzie całej apki po tym, jak wszystkie mechanizmy (plany
09–14) są na produkcji. Kierunek ze speca frontu (`2026-09-16-front-po-zalogowaniu-design.md`)
zostaje: ciemne szkło, krew, Bodoni tylko duży. Ten plan dokłada tło i grafiki
gry z Higgsfielda, ikony w stylu Instagrama, przyciski i pasek w „liquid
glass”, przejścia między ekranami, nowe logowanie, porządkuje kasyno, przerabia
ekrany admina i kończy się przeglądem każdego ekranu w przeglądarce.

Plan 15 rozdzielono na dwa (decyzja Mikołaja 2026-09-29): **15a — wygląd**
(ten spec) i **15b — porządek** (liczniki admina, układ „Więcej”, skreślenia
w bingo, feed). Każdy wdrażany osobno.

Przegląd zrzutów przed tym planem znalazł błąd, który uniemożliwiał korzystanie
z bingo (zamknięty `<dialog>` z klasą `flex` zasłaniał planszę; naprawione
w `34902fc`). Dlatego przegląd w przeglądarce jest częścią planu.

## 2. Zakres

**W zakresie:**

- tło całej apki z obrazu (Dym) zamiast trzech gradientów
- zestaw ikon SVG (styl Instagrama, obrys 3,2) i komponent `Pusto`
- przyciski i pasek nawigacji w stylu „liquid glass”
- przejścia między ekranami (`<ViewTransition>`)
- kasyno jako rozdroże z trzema kaflami; sloty pod `/app/arcade/sloty`
- kruk: tło, kolumny, sprite w 6 klatkach, kolizja z kapitelem
- blackjack: karty w szkle; sloty: bębny w sylwetce
- logowanie (`/wejscie`) z godłem
- przebieg po wszystkich ekranach admina (bez liczników — te w 15b)
- przegląd każdego ekranu w Chrome w widoku telefonu, z poprawkami

**Poza zakresem, świadomie:**

- **Landing** (`/`) — ma własną, jesienną oprawę; nie ruszamy.
- **Grafiki pozycji sklepiku** — odłożone, ale do zrobienia później.
- **Układ „Więcej”** i liczniki — plan 15b.
- Dźwięk.
- Zmiany w bazie — plan nie ma migracji.

## 3. Decyzje

**D1. Grafiki z Higgsfielda tylko tam, gdzie realizm jest zatwierdzony.**
Kruk (sprite), tło apki, tło gry, kolumna, godło. Ikony interfejsu **nie** są
generowane: realistyczne ryciny pustych stanów Mikołaj odrzucił (2026-09-29),
a płaskie ikony w stylu Instagrama są ostrzejsze i lżejsze jako ręczny SVG
(arkusz z Higgsfielda posłużył tylko jako wzorzec). Każdą grafikę pokazujemy
przed użyciem (`CLAUDE.md`).

**D2. Obróbka lokalnie.** Wycięcie tła w Higgsfieldzie (1 kredyt) tylko dla
kruka. Kolumna — kluczowanie jednolitej szarości; godło — czerń zamieniona na
kanał alfa (nie `mix-blend-mode`: `backdrop-filter` szkła izoluje warstwę
i czarny prostokąt zostaje). Na próby zeszło 28 kredytów z 270.

**D3. Tło apki to Dym, tło gry to Nawa.** Dym (łuki, dym, poświaty w rogach)
jest spokojny pod szkłem i tekstem — wybór Mikołaja. Nawa (katedra, świece)
była drugą propozycją tła apki; jako tło gry kosztuje 0 kredytów.

**D4. Kruk: 6 klatek z przenikaniem, 120 ms na klatkę.** Dwa arkusze póz
(drugi z pierwszym jako referencją); realnie 4 fazy skrzydeł i 2 warianty dołu.
Cykl `1 → 6 → 2 → 3 → 5 → 2 → 6` z przenikaniem sąsiednich klatek; 75 ms było
za szybko (uwaga Mikołaja).

**D5. Kolizja obejmuje kapitel.** Kapitel wystaje poza trzon; bez tego kruk
przelatywałby przez widoczny kamień. Rytm kolumn się nie zmienia, więc limit
w `kruk_wynik()` zostaje.

**D6. Karty w szkle, sloty w sylwetce.** Z porównania trzech kierunków.

**D7. Ikony: obrys w kółku, grubość 3,2.** Styl interfejsu Instagrama, bez
ozdobników, zaokrąglone końce; kółko 2,6. Wariant 2,5 był za cienki.

**D8. „Liquid glass” bez soczewki.** Prawdziwe załamanie światła z iOS 26
wymaga filtra SVG w `backdrop-filter`, którego Safari nie obsługuje. Jedna
wersja — jaśniejsze rozmycie, rant światła po krawędzi, miękki odblask
w górnej połowie, sprężyste wciśnięcie — wygląda tak samo wszędzie. Napisy
przyszarzone do `#ddd3d5` (uwaga Mikołaja: czysta biel za ostra).

**D9. Przejścia wbudowane w Next.** `<ViewTransition>` z Reacta, bez bibliotek
(`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Bez
obsługi w przeglądarce apka działa normalnie, tylko bez animacji.

**D10. Budżet wagi: 300 KB na wszystkie grafiki.** Tło apki (~9 KB) ładuje
się wszędzie; grafiki kruka tylko na jego ekranie; godło tylko na logowaniu.

## 4. Grafiki

Wszystkie w `public/grafika/`, WebP.

| Plik | Źródło (Higgsfield, job) | Obróbka | Rozmiar |
|---|---|---|---|
| `tlo-apki.webp` | `62ed825b-da9c-432e-b5c4-d7ce1ec37048` (Dym) | skala 900 px, jakość 0,7 | ~9 KB |
| `kruk/tlo.webp` | `3e8244a9-9241-4ef0-9fe3-c293e7bac14b` (Nawa) | skala 720 px, jakość 0,72 | ~22 KB |
| `kruk/kolumna.webp` | `70d9fbcd-cff5-4f82-aa1b-da2db79d5b2a` | kluczowanie szarości, przycięcie do szerokości, 160 px | ~16 KB |
| `kruk/klatka-1…6.webp` | arkusze `a79aeb34-7fd8-4069-800d-bdbe93513c20` i `17a803ff-f696-4c64-bbb4-c4f0d1e798cf`, wycięte `3940cb14-1571-4f6d-a947-40e0b25d8721` i `7ff2f288-d665-447a-88e8-101446b2db49` | cięcie po pustych kolumnach, wyrównanie do czubka dzioba, 480 × 475 | ~35 KB każda |
| `godlo.webp` | `7a4c6ddf-134b-4d21-b0d8-3ee3e6040350` | czerń → alfa, 400 px, jakość 0,75 | ≤ 80 KB |

Numeracja klatek: 1–3 z arkusza pierwszego od lewej, 4–6 z drugiego.

Prompty i adresy wyników leżą w projekcie Higgsfielda „JWK26 — oprawa
wizualna”. Oryginały PNG (2–7 MB) nie trafiają do repo. Skrypty obróbki
(cięcie klatek, czerń → alfa, kluczowanie, kompresja) trafiają do
`scripts/grafika/` z nagłówkiem, jak ich użyć. Wymagają `playwright-core`
i Chrome; nie są zależnością projektu (instalacja `--prefix` do katalogu
tymczasowego).

## 5. Ekrany

### Tło apki

W `src/app/layout.tsx` warstwa `fixed` z trzema gradientami dostaje obraz
`tlo-apki.webp` (`var(--color-noc) url(...) center/cover`) — ta sama warstwa,
ta sama rola. Nie `background-attachment: fixed` (iOS go ignoruje). Obraz
dostaje preload. Kolor `--noc` pod spodem: przed wczytaniem ekran wygląda jak
dziś, tylko ciemniej.

Landing ma własne tło; przy wdrożeniu sprawdzić, że go zakrywa. Jeśli warstwa
prześwituje na landingu, obraz dostaje tylko powłoka `/app` i ekrany gościa.

### Ikony

`src/components/Ikona.tsx` — jeden komponent, słownik kształtów w siatce
48 × 48, `stroke-width` 3,2, kółko 2,6, `currentColor`. Kształty z makiety:
oko, kielich, list (z pieczęcią jako kropką), świeca, karty, pióro. Rozmiary:
112 px w pustym stanie, 44 px przy pozycjach list. Plan 15b dokłada kształty
dla „Więcej”.

### Puste stany — komponent `Pusto`

`src/components/Pusto.tsx`: `ikona?` (nazwa kształtu), `children` (tekst).
Szklana karta, ikona w kolorze `dym` nad tekstem, `aria-hidden`. Bez `ikona` —
sama karta z tekstem (admin).

| Ekran | Ikona | Tekst (bez zmian) |
|---|---|---|
| Feed | oko | Tu wylądują zdjęcia z bingo… |
| Gossipy | list | Jeszcze nic. Pierwsza kategoria… |
| Kronika sklepiku | kielich | Nikt jeszcze niczego nie kupił. |
| Sloty — historia | świeca | Jeszcze żadnego spinu. |
| Blackjack — historia | karty | Jeszcze żadnego rozdania. |
| Kruk — ranking | pióro | Nikt jeszcze nie przeleciał… |

### Przyciski i pasek — „liquid glass”

`src/components/ui/Button.tsx`: warianty `krew` i `szklo` przechodzą na
płynne szkło z makiety `liquid-glass-v3` (D8): `backdrop-filter: blur(14px)
saturate(190%) brightness(1.12)`, gradient od jaśniejszej góry, rant światła
jako obramowanie z maską (`::before`), odblask w górnej połowie (`::after`),
`:active` — `scale(.965)` na krzywej sprężystej. `krew` to szkło zabarwione
czerwienią. Napisy `#ddd3d5`. `cichy` bez zmian.

Pasek nawigacji (`PasekNawigacji.tsx`) — to samo szkło; aktywna zakładka to
zabarwiona kapsuła. Przy `@supports not (backdrop-filter: …)` — nieprzezroczyste
tło jak dziś (spec frontu, §8).

Karty listy (`.szklo`) zostają przy obecnym szkle — płynne szkło na każdej
karcie przewijanej listy to za dużo rozmycia naraz dla słabszych telefonów.

### Przejścia między ekranami

- **Zakładki paska** (Ranking, Bingo, Feed, Sklep, Więcej): przenikanie treści
  — „to samo miejsce, inna zawartość”.
- **Wejście głębiej** (Więcej → Kasyno → Blackjack, Sanktuarium → Zapisy itd.):
  przesunięcie w lewo (`nav-forward`); **powrót** linkami „Wróć”: w prawo
  (`nav-back`). Linki dostają `transitionTypes`.
- Pasek nawigacji i nagłówek ekranu stoją w miejscu (`viewTransitionName`
  z wyłączoną animacją).
- `::view-transition { pointer-events: none }` — dotyk w trakcie animacji nie
  ginie.
- `prefers-reduced-motion` — bez przesunięć, samo przenikanie skrócone do zera.
- Czasy jak w przewodniku Next: wyjście 150 ms, wejście 210 ms, ruch 400 ms,
  przesunięcie 60 px.

### Kasyno

`/app/arcade` — saldo i trzy równorzędne kafle (link, ikona 44 px, nazwa,
podpis): **Sloty** (świeca, „stawka 10 · limit dzienny”), **Blackjack**
(karty, „stawka 10 · 20 · 50”), **Kruk** (pióro, „ranking, bez punktów”).
Sloty (bębny, obrót, historia) przenoszą się bez zmian logiki do
`/app/arcade/sloty`.

### Kruk

- `rysuj.ts`: tło (Nawa, `cover`, przyciemnione o ~25%), kolumny z grafiki
  (kapitel o stałej wysokości — górne 20% obrazu — i trzon rozciągany do
  potrzebnej długości; górna kolumna to odbicie w pionie), sprite z przenikaniem
  klatek (D4), pochylenie wg prędkości jak dziś.
- Szerokość trzonu w grafice = `SZER_KOLUMNY`; obraz rysowany szerzej (trzon to
  ~65% szerokości obrazka).
- `Lot.tsx` wczytuje obrazy przy montowaniu; do czasu wczytania rysuje obecną
  wersję wektorową.
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
„Jesienny Wyjazd Komisji · <data>” (z `app_settings.data_jwk`, jeśli gość może
ją odczytać — inaczej wiersz bez daty), szklana ramka „Wejście tylko dla
Samorządu. Zaloguj się kontem Google w domenie **samorzad.ue.wroc.pl**”,
przycisk Google z logo „G”. Na dole: „Nie mogę się zalogować” (furtka z kodem —
logika bez zmian) i „Regulamin”. Stany odmowy, oczekiwania na Google, kodu
i limitu wysyłki zostają.

### Admin

- Sanktuarium: ikony przy pozycjach (kształty z `Ikona`).
- Wspólne nagłówki sekcji i odstępy na ekranach list i formularzy.
- Szerokie tabele (Uczestnicy) przewijają się w poziomie wewnątrz ramki,
  nie całą stroną.
- `Pusto` bez ikony zamiast ręcznych ramek.
- Logika i uprawnienia bez zmian.

## 6. Przegląd ekranów

Po wdrożeniu każdy ekran uczestnika i admina w Chrome, 390 × 844, dotyk, na
bazie testowej, kontem testowym z rolą admina i punktami. Automatycznie:

- element pod palcem w kilku punktach ekranu to treść, nie niewidoczna nakładka;
- brak błędów w konsoli;
- brak poziomego przewijania strony (`scrollWidth ≤ clientWidth`);
- cele dotykowe ≥ 44 px.

Ręcznie, na zrzutach: czytelność tekstu na nowym tle. Klikane ścieżki: arkusz
bingo, zakup w sklepiku, głos w gossipach, rozdanie w blackjacku, spin, lot
kruka, przejścia w przód i w tył, logowanie bez sesji. Każdy znaleziony błąd —
poprawka w tym planie, osobnym commitem.

## 7. Testy

Wyglądu nie testujemy automatycznie (jak w specu z 16.09). Nowy test: kolizja
kruka z kapitelem (`tests/kruk-fizyka.test.ts`). Pełny zestaw, lint i build
muszą przechodzić.

## 8. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Szkło na obrazie i płynne szkło przycisków tną płynność na słabszych telefonach | Płynne szkło tylko na przyciskach i pasku, nie na kartach listy; sprawdzenie na telefonie przy weryfikacji kasyna |
| Przejścia gubią dotyk albo migają na Safari | `pointer-events: none` na nakładce; bez obsługi — brak animacji, nie błąd |
| Tekst nieczytelny na jaśniejszych miejscach tła | Przegląd zrzutów (§6); w razie potrzeby przyciemnienie warstwy |
| Grafiki kruka nie wczytają się przy słabym zasięgu | Wektorowy zapas do czasu wczytania |
