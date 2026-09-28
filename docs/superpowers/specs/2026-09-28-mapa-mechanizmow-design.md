# Mapa pozostałych mechanizmów — spec projektowy

Data: 2026-09-28
Status: zatwierdzony
Poprzedza: plany 09–16

## 1. Czym to jest

Kolejność, wersje minimalne i zależności wszystkiego, co zostało do zbudowania
przed wyjazdem (23.10.2026). Każdy mechanizm dostaje potem własny krótki spec
albo — gdy ta mapa wystarcza — od razu plan. Zasada: najpierw wszystkie
mechanizmy w najprostszej działającej formie, potem jeden przebieg dopracowania
wyglądu.

**Zrobione:** fundament i logowanie (OTP przez Resend na `jwk26.pl`), zapisy
(tury, rezerwa, zgody, przelew z kodem QR), ranking na żywo, panel admina, bingo
z feedem, sklepik, sloty.

## 2. Kolejność

Według terminów, nie według zależności technicznych — kolejny mechanizm
wchodzi wtedy, kiedy przestaje być opcjonalny.

| Plan | Mechanizm | Termin | Zależy od |
|---|---|---|---|
| 09 | Lista przyjętych | do 3.10 | zapisy (gotowe) |
| 10 | Arkusz Google (GAS) | do 8.10 | zmiana klauzuli (Google jako podmiot przetwarzający) |
| 11 | Push i ogłoszenia | do 11.10 | — |
| 12 | Gossipy | do 15.10 | 11 tylko przez tabelę `powiadomienia` |
| 13 | Blackjack | do 18.10 | fundament kasyna (gotowy) |
| 14 | Dino | do 20.10 | — |
| 15 | Wygląd | 18–22.10 | wszystkie powyższe |
| 16 | SMS | po wszystkim, jeśli jest konto i budżet | 11 |

Wpłaty ruszają 12.10 — do tego dnia muszą działać 09 i 10, żeby zespół widział
zapisy. Push (11) musi działać od pierwszej minuty wyjazdu.

**Rzeczy do uruchomienia wcześniej, poza kodem:**
- klauzula: dopisać Google (arkusz) jako podmiot przetwarzający, zanim arkusz
  zostanie udostępniony (zrobione 2026-09-28, wersja zgód `2026-09-28.2`);
- SMSAPI: konto i zatwierdzenie nadawcy „JWK26" trwa 1–3 dni — jeśli SMS-y mają
  mieć szansę, zgłosić wcześnie.

## 3. Wersje minimalne i decyzje

### 09 · Lista przyjętych

- Trasa `/app/admin/uczestnicy`: przyjęte zgłoszenia z `dane_wrazliwe`, filtry
  pula i drużyna. Kolumny: osoba, ksywka, pula, drużyna, telefon, dojazd,
  zwolnienie, alkohol, zgoda na wizerunek, dieta, alergie, choroby i leki, ICE.
- Eksport CSV przez trasę serwerową sprawdzającą rolę admina. Plik zawiera dane
  o zdrowiu — ostrzeżenie przy przycisku, nic z treści w logach ani w URL.
- Bez migracji: RLS już wpuszcza admina do obu tabel.

### 10 · Arkusz Google

- **Zawartość: wszystko**, łącznie z danymi wrażliwymi (decyzja Mikołaja), w dwóch
  zakładkach: „Zapisy" i „Dane wrażliwe". Wszystkie zgłoszenia — miejsce,
  rezerwa, przyjęte, odrzucone.
- Skrypt GAS co 5 minut **pełnym nadpisaniem** — odporny na zgubiony przebieg,
  a retencja z bazy (kasowanie diet po wyjeździe) przenosi się do arkusza sama.
- Bez klucza serwisowego w skrypcie (daje pełny dostęp do bazy). Zamiast tego
  funkcja `eksport_arkusza(sekret)` prawami właściciela, sprawdzająca długi losowy
  sekret z tabeli bez żadnych grantów.
- Arkusz udostępniany wyłącznie imiennie; Sheets nie ukrywa zakładek przed kimś,
  kto ma dostęp do pliku.
- Kod skryptu w repo (`gas/`).
- Wymaga zmiany klauzuli (Google jako podmiot przetwarzający).

### 11 · Push i ogłoszenia

- Service worker, klucze VAPID w zmiennych Vercela, tabela `push_subscriptions`,
  przełącznik powiadomień w „Więcej".
- Ogłoszenie z panelu do: wszystkich, drużyny albo puli.
- Automaty: przyjęcie zgłoszenia, zaakceptowane pole bingo drużyny, ujawnienie
  wyników gossipów.
- Wysyłka przez istniejącą tabelę `powiadomienia` (outbox ze sklepiku):
  wstawienie wiersza wywołuje przez `pg_net` trasę `/api/push`, a `pg_cron`
  co minutę ponawia niewysłane. Mechanizmy tylko dopisują wiersz.
- `adresat` rozszerzony o `all` i `pula`.
- iOS: push tylko w zainstalowanej PWA (16.4+) — zamek instalacji już to wymusza.

### 12 · Gossipy

- Admin tworzy kategorię i nominuje; uczestnik oddaje jeden głos na kategorię
  z uzasadnieniem min. 200 znaków (`gossip_min_justification`); nie na siebie.
- Ściana anonimowa: tabela głosów zamknięta, widok bez autora, odświeżanie
  kanałem broadcast zamiast `postgres_changes` (§5 speca głównego).
- Admin ukrywa niestosowne uzasadnienia i ujawnia wyniki (push).
- **Bez punktów.**

### 13 · Blackjack

- Dobierz / stań / podwój; krupier staje na 17; blackjack 3:2.
  Po pierwszych grach (2026-09-28) przewaga kasyna podniesiona: blackjack 6:5,
  krupier dobiera na miękkie 17, podwojenie tylko przy 9–11.
- **Stawka do wyboru: 10, 20 albo 50** — trzy przyciski, bez wpisywania kwoty.
- `game_sessions.state` z talią już zamknięte; limit obrotu wspólny ze slotami
  (`obrot_w_oknie` liczy wszystkie gry).
- Ręka porzucona na 10 minut rozstrzygana jak „stań".

### 14 · Dino

Zmienione (2026-09-28) na **Kruka** — lot przez szczeliny zamiast biegu, spec
`2026-09-28-kruk-design.md`. Bez punktów, ranking osób.

- Gra w canvasie; wynik zapisuje funkcja z sanity checkami (jeden wynik na grę,
  maksymalny przyrost na minutę).
- **Bez punktów — tylko ranking**, więc podrobiony wynik psuje najwyżej ranking dino.

### 15 · Wygląd

- Jeden przebieg po wszystkich ekranach, w obecnym kierunku (ciemne szkło, krew,
  Bodoni). Na końcu, gdy żaden ekran już się nie zmienia. Ryzyko: brak czasu =
  surowe ekrany na wyjeździe.

### 16 · SMS

- Drugi transport obok push dla tej samej tabeli `powiadomienia` (kanał `sms` już
  jest), do osób ze zgodą. Tylko jeśli będzie konto i nadawca.

## 4. Czego ta mapa nie ustala

Szczegółów ekranów i schematów — te powstają w specach/planach poszczególnych
mechanizmów. Mapa wiąże wyłącznie zakres minimalny, kolejność i decyzje powyżej.
