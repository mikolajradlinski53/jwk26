# Porządek (15b) — spec projektowy

Data: 2026-09-29
Status: do przeglądu
Poprzedza: plan 15b. Siostrzany: `2026-09-28-wyglad-design.md` (plan 15a).

## 1. Czym to jest

Druga połowa planu 15 (podział: decyzja Mikołaja 2026-09-29). Tam, gdzie 15a
zmienia wygląd, 15b zmienia **to, jak się z apki korzysta**: admin widzi, że
coś na niego czeka, zanim sam zajrzy; „Więcej” przestaje być workiem na
wszystko; bingo nagradza zaliczone pole animacją; feed dostaje nagłówek z logo
i przestaje zjadać limit transferu.

Zależy od 15a tylko przez komponent `Ikona` (kształty dla „Więcej”) — 15b
wchodzi po 15a.

## 2. Zakres

**W zakresie:**

- liczniki kolejek admina: pasek → „Więcej” → Sanktuarium → pozycja
- znacznik „przejrzane” dla uzasadnień w gossipach (migracja)
- nowy układ „Więcej” w sekcjach, z ikonami
- animacja skreślenia zaliczonego pola w bingo
- feed: nagłówek z logo JWK, podglądy zdjęć, stałe adresy zdjęć z pamięcią
  przeglądarki

**Poza zakresem, świadomie:**

- **Filmy w feedzie** — tylko zdjęcia (decyzja Mikołaja). Na planie Free
  filmy wyczerpałyby 1 GB miejsca i 5 GB transferu w dniach.
- Wiele zdjęć na jedno pole bingo — zostaje jedno zdjęcie na pole.
- Grafiki sklepiku — odłożone.

## 3. Decyzje

**D1. Cztery kolejki, jedna funkcja.** Licznik zapalają: zamówienia sklepiku
do wydania, zdjęcia bingo do akceptacji, zgłoszenia na wyjazd do rozpatrzenia,
uzasadnienia w gossipach do przejrzenia (decyzja Mikołaja: wszystkie cztery).
Liczy je jedna funkcja `admin_kolejki()` (prawami właściciela, tylko dla
admina), zwracająca cztery liczby — jedno zapytanie zamiast czterech i jedno
miejsce z definicją „czeka”.

**D2. Odświeżanie: przy wejściu na ekran, przy powrocie do apki i co 30 s.**
Realtime obejmuje dziś tylko `points_ledger` i `shop_orders`; dopisywanie
kolejnych tabel do publikacji dla czterech liczb u kilku adminów jest
niewspółmierne. Admin i tak dostaje push o zamówieniu (plan 11). Istniejący
`LicznikZamowien` z realtime zostaje zastąpiony tym samym mechanizmem, żeby
liczby na pasku i w Sanktuarium nie rozjeżdżały się.

**D3. Licznik wędruje w dół drzewa.** Pasek: suma na ikonie „Więcej”.
„Więcej”: suma przy „Sanktuarium”. Sanktuarium: liczba przy każdej pozycji
osobno. Liczba znika, gdy kolejka jest pusta. Uczestnik bez roli admina nie
widzi niczego i funkcja mu odmawia.

**D4. „Przejrzane” zamiast samego ukrywania.** Dziś admin może uzasadnienie
tylko ukryć — nie ma czego liczyć. Kolumna `przejrzane_at` na `gossip_votes`;
w panelu przycisk „Przejrzane” obok „Ukryj”; ukrycie też oznacza jako
przejrzane. Kolejka = nieukryte i nieprzejrzane.

**D5. Stałe adresy zdjęć zamiast podpisanych.** Feed generuje dziś podpisany
adres ważny godzinę przy każdym wejściu — przeglądarka nie może nic zapamiętać
i każde wejście pobiera wszystkie zdjęcia od nowa. To główny zjadacz limitu
5 GB transferu w Supabase Free. Zdjęcia idą przez trasę apki
`/app/feed/zdjecie/[id]` (za bramką sesji): pobiera plik z magazynu klientem
użytkownika (RLS nadal decyduje, kto co widzi) i odpowiada z
`Cache-Control: private, max-age=604800, immutable` — zdjęcie z bingo nigdy się
nie zmienia. Ruch przez Vercela liczy się do jego limitu (100 GB na Hobby),
nie do Supabase.

**D6. Podgląd do feedu, pełne zdjęcie po dotknięciu.** Przy wysyłce telefon
robi dwa pliki: pełny (jak dziś, ~400 KB) i podgląd (720 px, ~60–80 KB, obok
w magazynie z przyrostkiem `.podglad.jpg`). Feed pokazuje podgląd; dotknięcie
otwiera pełne. Stare zdjęcia bez podglądu — trasa oddaje pełne. Szacunek:
60 osób × 150 zdjęć × 70 KB ≈ 630 MB na pełne przejrzenie feedu przez
wszystkich, a dzięki D5 — tylko raz na osobę.

**D7. Skreślenie gra raz.** Animacja przy polu, które zostało zaliczone od
ostatniej wizyty tej osoby na planszy (lista obejrzanych pól w `localStorage`,
per drużyna). Później pole stoi już skreślone bez animacji. Brak dostępu do
`localStorage` (tryb prywatny) — bez animacji, nie błąd.

## 4. Baza

Migracja `…_porzadek.sql`:

```sql
alter table gossip_votes add column przejrzane_at timestamptz;

-- admin_kolejki(): tylko admin (public.is_admin()), inaczej wyjątek.
-- Zwraca jsonb:
--   sklepik      — shop_orders   where status = 'pending'
--   bingo        — bingo_submissions where status = 'pending'
--   zgloszenia   — registrations where status = 'pending'
--   gossipy      — gossip_votes  where not hidden and przejrzane_at is null
```

Funkcja do oznaczania przejrzanego (`gossip_przejrzane(p_glos uuid)`, tylko
admin) albo rozszerzenie istniejącej funkcji ukrywania — do rozstrzygnięcia
w planie po przeczytaniu `gossipy.sql`; ukrycie ustawia też `przejrzane_at`.

## 5. Ekrany

### Liczniki

- `src/components/KolejkiAdmina.tsx` — kontekst kliencki: dla admina wywołuje
  `admin_kolejki()` (D2), udostępnia liczby. Dla nie-admina nic nie robi
  (rola z profilu przekazana z layoutu).
- Znacznik liczby — ten sam kształt co dzisiejszy `LicznikZamowien` (krwista
  kapsuła, `tabular-nums`, `aria-label` z pełnym zdaniem).
- Pasek (`PasekNawigacji.tsx`): znacznik na ikonie „Więcej”, w prawym górnym
  rogu ikony.
- „Więcej”: przy „Sanktuarium”. Sanktuarium: przy Sklepiku, Bingo,
  Zgłoszeniach, Gossipach.

### „Więcej” w sekcjach

Od góry:

1. **Karta osoby** — ksywka, drużyna, saldo (jak dziś).
2. **Organizator** (tylko admin) — Sanktuarium, z licznikiem.
3. **Zabawa** — Kasyno („Sloty, blackjack i kruk”), Gossipy („Anonimowe
   głosowania”).
4. **Ustawienia** — Powiadomienia (przełącznik jak dziś), Twoje zgody.
5. **Informacje** — Regulamin, Polityka prywatności (gdy powstanie — zob.
   `docs/formalnosci.md`, pkt 3), Kontakt z organizatorem (mail samorządu).
6. **Opuść sektę**.

Każda pozycja: ikona 44 px (`Ikona`, nowe kształty: kości do gry dla kasyna,
dzwonek, tarcza, zwój, koperta), nazwa, jednozdaniowy opis. Nagłówki sekcji
jak w reszcie apki (małe, rozstrzelone, `dym`).

### Bingo — skreślenie

Zaliczone pole dostaje czerwoną kreskę rysowaną przez nazwę zadania (SVG,
`stroke-dashoffset` od 100% do 0, ~450 ms, lekko nieregularna jak odręczna)
i krótki błysk tła. Kolejne pola zaliczone od ostatniej wizyty skreślają się
po kolei co ~150 ms. `prefers-reduced-motion` — kreska od razu, bez rysowania.

### Feed

- Nagłówek: logo JWK (`public/logo/logo-biale.png`, ~40 px wysokości)
  i pod nim mniejszymi literami „feed” (Manrope, rozstrzelone, `dym`) —
  zamiast dzisiejszego tytułu „Feed” w Bodoni.
- Zdjęcia: `<img src="/app/feed/zdjecie/<id>?podglad">`, `loading="lazy"`,
  `decoding="async"`; dotknięcie — pełne zdjęcie w arkuszu na cały ekran.
- Wysyłka w bingo (`Plansza.tsx`, `src/lib/obrazy.ts`): drugi plik podglądu
  wysyłany obok pełnego.

## 6. Testy

- Baza: `admin_kolejki()` — admin dostaje cztery liczby zgodne ze stanem;
  uczestnik dostaje odmowę; przejrzane i ukryte uzasadnienia nie liczą się.
- Trasa zdjęć: nagłówek `Cache-Control`; osoba bez sesji dostaje
  przekierowanie (bramka); zdjęcie niezaakceptowane cudzej drużyny — 404
  (RLS).
- Reszta ręcznie w przeglądarce: znaczniki na pasku i w drzewie, skreślenie
  w bingo, podgląd i pełne zdjęcie w feedzie.

## 7. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Co 30 s zapytanie u każdego admina | Tylko przy widocznej apce; kilku adminów — pomijalne |
| Pamięć przeglądarki trzyma zdjęcie, które admin potem ukrył | Ukrycie usuwa je z listy feedu; bezpośredni adres zna tylko ktoś, kto już je widział |
| Podgląd nie wyśle się przy słabym zasięgu | Wysyłka pełnego zdjęcia decyduje o sukcesie; brak podglądu — trasa oddaje pełne |
| Limit transferu Supabase mimo wszystko | Monitor w panelu Supabase (Usage) w trakcie wyjazdu; w razie czego Pro na październik (25 USD, 250 GB) |
