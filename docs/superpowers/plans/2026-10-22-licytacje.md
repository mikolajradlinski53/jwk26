# Licytacje zamiast sklepiku — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sklepik (zakup po stałej cenie) zastąpiony licytacjami: admin wystawia przedmiot, kapitanowie przebijają się punktami drużyny, licytacja zamyka się sama o godzinie admina.

**Architecture:** Cała logika w Postgresie (Supabase): tabele `licytacje` i `licytacje_oferty`, funkcje SECURITY DEFINER z blokadami wierszy (wzór: `kup_z_polki` w `supabase/migrations/20261008130000_sklepik_ukryte_nagrody.sql`), zamykanie i ogłaszanie otwarcia przez `pg_cron` co minutę. Next.js tylko wyświetla (`/app/sklep`, panel `/app/admin/sklepik`) i woła RPC. Realizacja wygranej używa istniejących `shop_orders` / `active_effects` / `points_ledger`.

**Tech Stack:** Next.js (wersja z repo — przed kodem przeczytaj `node_modules/next/dist/docs/` wg AGENTS.md), Supabase (Postgres, RLS, RPC, Storage, Realtime, pg_cron), vitest (`tests/db`, helpery w `tests/helpers/supabase.ts`).

**Spec:** `docs/superpowers/specs/2026-10-22-licytacje-design.md`

## Global Constraints

- Licytuje wyłącznie kapitan (`public.is_captain(team)`) drużyny jawnej (`teams.ukryta = false`); Kadra nie licytuje.
- Pierwsza oferta ≥ cena wywoławcza; kolejna ≥ najwyższa + `app_settings.licytacja_krok` (wartość startowa `10`).
- Prowadząca drużyna nie przebija samej siebie; ofert nie da się wycofać.
- Dostępne saldo = `sum(points_ledger.delta)` drużyny − suma kwot, w których drużyna prowadzi w licytacjach `status='trwa'`.
- Oferta po `koniec` (albo przed `start`) odrzucona przez bazę niezależnie od crona.
- Zamknięcie: od najwyższej oferty w dół, każda drużyna swoją najwyższą ofertą; wygrywa pierwsza drużyna z saldem ≥ oferta w chwili zamknięcia; brak takiej → bez zwycięzcy. Saldo nigdy poniżej zera przez licytację.
- Płatność: jeden wpis w księdze `delta = -cena`, `category = 'licytacja'`, `ref_type = 'licytacja'`, `ref_id = licytacja.id`, `user_id = null`.
- Klątwa po wygranej: zamówienie `pending` bez celu; ofiarę wybiera kapitan zwycięzcy albo admin (`rzuc_klatwe`); bez limitu czasu.
- W ciemno (`licytacje.w_ciemno`): do zamknięcia uczestnik nie dostaje nazwy, opisu, grafiki ani ikony przedmiotu; powiadomienia nie zdradzają przedmiotu.
- Komunikaty błędów z bazy: kody wielkimi literami (np. `ZA_MALO`), UI tłumaczy je na polski.
- Teksty w UI po polsku, styl istniejących ekranów (`szklo`, `krew`, `kosc`, `dym`).
- Wdrożenie (wg pamięci projektu): migracja na test (`cmuyeoobmidawmyxwihk`) → testy → prod (`tjjlslupthlylnxvfroz`) z relinkiem testu w tej samej komendzie → commit → push.

## Review Focus

- Dwie oferty dwóch drużyn w tej samej sekundzie na tę samą licytację — tylko jedna może być „najwyższa”, druga musi spełnić krok względem pierwszej (blokada wiersza licytacji). Test: `licytuj` sekwencyjnie z tą samą kwotą od dwóch drużyn → druga dostaje `ZA_MALO`.
- Drużyna prowadzi w dwóch licytacjach naraz — trzecia oferta przekraczająca dostępne saldo odrzucona (`BRAK_PUNKTOW`), choć saldo z księgi by starczyło. Test w Task 1.
- Lider stracił punkty po ofercie — zamknięcie oddaje przedmiot drugiej drużynie. Test w Task 2.
- Cron odpalony dwa razy na tej samej licytacji — jeden wpis w księdze. Test w Task 2 (`licytacje_tick()` ×2).
- Licytacja w ciemno — uczestnik nie widzi nazwy/grafiki przed zamknięciem, widzi po. Test w Task 1 i 2.

---

### Task 1: Schemat, oferty i widok licytacji (baza)

**Files:**
- Create: `supabase/migrations/20261022140000_licytacje.sql`
- Test: `tests/db/licytacje.test.ts`
- Modify: `tests/helpers/supabase.ts` (helper `nowaLicytacja`)

**Interfaces:**
- Produces (SQL):
  - tabela `licytacje(id uuid pk, item_id uuid not null → shop_items, cena_wywolawcza int not null check >0, start timestamptz not null default now(), koniec timestamptz not null check (koniec > start), w_ciemno boolean not null default false, status text not null default 'trwa' check in ('trwa','zamknieta','anulowana'), otwarcie_ogloszone boolean not null default false, zwyciezca_team uuid → teams, cena_koncowa int, order_id uuid → shop_orders, created_by uuid, created_at timestamptz default now())`
  - tabela `licytacje_oferty(id uuid pk, licytacja_id uuid not null → licytacje on delete cascade, team_id uuid not null → teams, user_id uuid not null → profiles, kwota int not null check >0, created_at timestamptz default now())`, indeks `(licytacja_id, kwota desc)`
  - kolumna `shop_items.grafika text` (ścieżka w buckecie `przedmioty`)
  - bucket `przedmioty` (public = true); storage insert/update/delete tylko `is_admin()`
  - `app_settings`: `licytacja_krok = 10`
  - RLS: `licytacje` i `licytacje_oferty` — SELECT dla `is_approved() or is_admin()`; INSERT/UPDATE/DELETE na `licytacje` tylko `is_admin()`; `licytacje_oferty` bez zapisu z API (tylko przez `licytuj`)
  - obie tabele w publikacji `supabase_realtime`
  - `public.dostepne_saldo(p_team uuid) returns integer` (stable, security definer) — saldo − blokady
  - `public.licytuj(p_licytacja uuid, p_kwota integer) returns void` — błędy: `NIE_KAPITAN`, `LICYTACJA_NIEAKTYWNA`, `ZA_MALO`, `JUZ_PROWADZICIE`, `BRAK_PUNKTOW`
  - `public.licytacje_lista() returns table(id uuid, status text, start timestamptz, koniec timestamptz, w_ciemno boolean, cena_wywolawcza int, najwyzsza int, prowadzi_team uuid, prowadzi_nazwa text, prowadzi_kolor text, liczba_ofert int, nazwa text, opis text, grafika text, ikona text, efekt text, zwyciezca_team uuid, zwyciezca_nazwa text, cena_koncowa int, order_id uuid)` — `nazwa/opis/grafika/ikona/efekt` = NULL gdy `w_ciemno and status='trwa' and not is_admin()`; zwraca licytacje trwające, zapowiedziane (start > now()) i zamknięte z ostatnich 48 h; bez anulowanych
- Produces (test helper): `nowaLicytacja(o: { itemId: string; cena?: number; startZa?: number /*min*/; koniecZa?: number /*min*/; wCiemno?: boolean }): Promise<string>` — insert kluczem serwisowym

- [ ] **Step 1: Write the failing tests** (`tests/db/licytacje.test.ts`, setup: dwie jawne drużyny z `idDruzyn()`, kapitanowie przez `ustawKapitana`, punkty przez `dosypPunkty`, zwykły członek, admin; afterEach czyści `licytacje`, księgę kategorii `licytacja`/`admin_adjust` użytą w testach, `shop_orders` z licytacji)
  - `pierwsza oferta poniżej ceny wywoławczej odrzucona` → `licytuj(id, cena-1)` błąd `ZA_MALO`; `licytuj(id, cena)` OK
  - `przebicie wymaga kroku` → po ofercie 100 drużyny A, drużyna B 105 → `ZA_MALO`, 110 → OK
  - `prowadzący nie przebija siebie` → A 100, A 120 → `JUZ_PROWADZICIE`
  - `licytuje tylko kapitan drużyny jawnej` → zwykły członek → `NIE_KAPITAN`; admin w Kadrze → `NIE_KAPITAN`
  - `blokada punktów` → A ma 150 pkt, prowadzi w licytacji X kwotą 100; oferta 60 w licytacji Y → `BRAK_PUNKTOW`; `dostepne_saldo(A) = 50`; po przebiciu A w X przez B → `dostepne_saldo(A) = 150` i oferta 60 w Y przechodzi
  - `po końcu i przed startem oferta odrzucona` → licytacja z `koniec` w przeszłości (insert z `start = now()-2h, koniec = now()-1h`) → `LICYTACJA_NIEAKTYWNA`; `startZa: 30` → `LICYTACJA_NIEAKTYWNA`
  - `ta sama kwota od dwóch drużyn` → A 100 OK, B 100 → `ZA_MALO`
  - `przebita drużyna dostaje powiadomienie` → po A 100, B 110: w `powiadomienia` wiersz `kanal='push', adresat='team', adresat_id=A, link='/app/sklep'`, `tytul` zawiera „przebito”
  - `w ciemno uczestnik nie widzi przedmiotu` → `licytacje_lista()` przez klienta uczestnika: `nazwa, opis, grafika, ikona, efekt` = null, `najwyzsza` widoczna; przez admina — nazwa widoczna
  - `uczestnik nie wstawi oferty ani licytacji z API` → insert do `licytacje_oferty` i `licytacje` klientem uczestnika → błąd
- [ ] **Step 2: Run tests against the test DB to verify they fail**
  Run: `npx vitest run tests/db/licytacje.test.ts`
  Expected: FAIL (brak tabel/funkcji)
- [ ] **Step 3: Write `supabase/migrations/20261022140000_licytacje.sql`** — interfejsy jak wyżej. `licytuj`: kolejność blokad — najpierw wiersz `licytacje` (`for update`), potem wiersz `teams` drużyny (`for update`, zamek salda jak w `kup_z_polki`). Najwyższa oferta = `max(kwota)` z `licytacje_oferty` tej licytacji; lider = drużyna tej oferty. Powiadomienie o przebiciu: `insert into powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id) values ('push','team', poprzedni_lider, 'Was przebito', <dla w_ciemno: 'Tajemnicza nagroda' zamiast nazwy> || ' - teraz ' || kwota || ' pkt (' || nazwa_druzyny || ')', '/app/sklep', 'licytacja', id)`. `grant execute` na `licytuj`, `licytacje_lista`, `dostepne_saldo` dla `authenticated`, revoke od `anon, public`.
- [ ] **Step 4: Push to test DB and run tests**
  Run: `test "$(cat supabase/.temp/project-ref)" = cmuyeoobmidawmyxwihk && npx supabase db push` potem `npx vitest run tests/db/licytacje.test.ts`
  Expected: wszystkie PASS
- [ ] **Step 5: Commit** — `git add supabase/migrations/20261022140000_licytacje.sql tests/db/licytacje.test.ts tests/helpers/supabase.ts && git commit -m "Licytacje: schemat, oferty z blokadą punktów, widok"`

### Task 2: Zamykanie, realizacja wygranej i Klątwa (baza)

**Files:**
- Create: `supabase/migrations/20261022150000_licytacje_zamkniecie.sql`
- Test: `tests/db/licytacje.test.ts` (nowy `describe`)

**Interfaces:**
- Consumes: tabele i `licytuj` z Task 1
- Produces (SQL):
  - `public.licytacje_tick() returns void` (security definer; execute tylko `service_role`/postgres) — (1) dla `status='trwa' and start <= now() and not otwarcie_ogloszone`: push `adresat='all'`, `tytul='Licytacja otwarta'`, body: nazwa (albo „Tajemnicza nagroda”) + ` - cena wywoławcza X pkt`, `link='/app/sklep'`; ustaw flagę; (2) dla `status='trwa' and koniec <= now()` (`for update skip locked`): rozstrzygnięcie wg Global Constraints, `zrealizuj_wygrana`, status `zamknieta`, push `all`: „<drużyna> wygrywa <przedmiot> za X pkt” albo „<przedmiot>: bez zwycięzcy” (po zamknięciu nazwa jawna)
  - `public.zrealizuj_wygrana(p_licytacja uuid, p_team uuid, p_cena int, p_user uuid) returns uuid` (internal, bez grantów) — wpis w księdze (Global Constraints), `shop_orders(team_id, item_id, price_paid, ordered_by, status)`; `digital` z `effect_key <> 'klatwa'` → `active_effects` jak w `kup_z_polki` + zamówienie `fulfilled`; `klatwa` → zamówienie `pending`, `target_team_id null`; `physical` → `pending` (kolejka wydań admina). Ustawia `licytacje.order_id`. Zwraca id zamówienia.
  - `public.rzuc_klatwe(p_order uuid, p_target uuid) returns void` — dozwolone: `is_captain(order.team_id)` albo `is_admin()`; zamówienie `pending`, przedmiot `effect_key='klatwa'`, `target_team_id is null`; cel ≠ własna, cel jawny i istnieje; blokady drużyn po id (jak `kup_z_polki`); Tarcza ofiary pochłania (`note='Tarcza pochlonela rzut'`) albo księga `-effect_value` dla ofiary (`category='klatwa'`); zamówienie `fulfilled` z `target_team_id`; push do ofiary jak dziś. Błędy: `BRAK_UPRAWNIEN`, `ZAMOWIENIE_NIEAKTYWNE`, `ZLY_CEL`.
  - `revoke execute on function public.kup_z_polki(uuid, uuid) from authenticated` (sklepik z kupowaniem znika)
  - `cron.schedule('licytacje', '* * * * *', 'select public.licytacje_tick()')`

- [ ] **Step 1: Write the failing tests** (wołanie `admin.rpc("licytacje_tick")` kluczem serwisowym; licytację „po czasie” robić przez update `koniec = now() - interval '1 second'` po ofertach)
  - `zamknięcie: najwyższa oferta wygrywa, jeden wpis w księdze` → A 100, B 120, tick → `status='zamknieta'`, `zwyciezca_team=B`, `cena_koncowa=120`, księga B: jeden wpis `-120` `category='licytacja'`; drugi tick → nadal jeden wpis
  - `lider bez pokrycia oddaje przedmiot dalej` → A 100, B 120, B traci punkty (`dosypPunkty(B, -saldoB+50)`), tick → zwycięzca A za 100; B bez wpisu
  - `nikt nie może zapłacić → bez zwycięzcy` → `zwyciezca_team null`, `status='zamknieta'`, brak wpisów `licytacja`
  - `bez ofert → bez zwycięzcy` 
  - `Błogosławieństwo działa po wygranej` → `active_effects` dla zwycięzcy z `effect_key='blogoslawienstwo'`, zamówienie `fulfilled`
  - `nagroda fizyczna trafia do kolejki wydań` → zamówienie `pending`
  - `Klątwa: kapitan wybiera ofiarę po wygranej` → zamówienie `pending` bez celu; `rzuc_klatwe` przez kapitana zwycięzcy na C → C traci `effect_value`, zamówienie `fulfilled`; drugi `rzuc_klatwe` → `ZAMOWIENIE_NIEAKTYWNE`
  - `Klątwa: admin wybiera za kapitana; obcy kapitan nie może` → kapitan innej drużyny → `BRAK_UPRAWNIEN`; admin → OK
  - `Klątwa: Tarcza ofiary pochłania` → ofiara z czynną tarczą: bez wpisu w księdze, tarcza `consumed_at` ustawione
  - `otwarcie ogłoszone raz` → licytacja `startZa: 0`, tick ×2 → jeden push `adresat='all'`, `tytul='Licytacja otwarta'`; dla `wCiemno` body nie zawiera nazwy przedmiotu
  - `po zamknięciu w ciemno nazwa jawna` → `licytacje_lista()` uczestnika zwraca `nazwa` po zamknięciu
  - `zakup z półki wyłączony` → `kup_z_polki` przez kapitana → błąd
- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run tests/db/licytacje.test.ts` → FAIL (brak `licytacje_tick`)
- [ ] **Step 3: Write `supabase/migrations/20261022150000_licytacje_zamkniecie.sql`** — wybór zwycięzcy:
  ```sql
  for v_kand in
    select distinct on (team_id) team_id, kwota, user_id
    from public.licytacje_oferty where licytacja_id = v_l.id
    order by team_id, kwota desc
  -- potem posortuj kandydatów po kwota desc (podzapytanie) i dla każdego:
  --   perform 1 from teams where id = team for update;
  --   if saldo(team) >= kwota then zwycięzca; exit;
  ```
- [ ] **Step 4: Push to test DB and run** — jak Task 1 Step 4; Expected: PASS, także `tests/db/sklepik*.test.ts` przejrzeć: testy kupowania z półki (`kup_z_polki`) usunąć albo przerobić na sprawdzenie, że zakup jest wyłączony; pozostałe (efekty, tarcza w bingo) muszą przejść
- [ ] **Step 5: Commit** — migracja + testy, „Licytacje: zamykanie co minutę, realizacja wygranej, Klątwa po wygranej”

### Task 3: Ekran licytacji dla uczestników

**Files:**
- Modify: `src/app/app/sklep/page.tsx` (przepisany na licytacje), `src/app/app/sklep/loading.tsx` (podtytuł), `src/components/PasekNawigacji.tsx` (etykieta „Licytacje”), `src/types/db.ts` (typ `LicytacjaWidok` = wiersz `licytacje_lista`)
- Create: `src/app/app/sklep/KartaLicytacji.tsx` (client), `src/app/app/sklep/LicytacjeNaZywo.tsx` (client), `src/lib/licytacje.ts` (komunikaty błędów, minimalna oferta)
- Delete: `src/app/app/sklep/Polka.tsx`, `src/app/app/sklep/Kronika.tsx` (jeśli nigdzie indziej nieużywane — sprawdź grepem)

**Interfaces:**
- Consumes: `licytacje_lista()`, `licytuj`, `dostepne_saldo`, `rzuc_klatwe` z Task 1–2; `team_scores` (saldo), `teams` (lista ofiar)
- Produces:
  - `minimalnaOferta(l: LicytacjaWidok, krok: number): number` — `najwyzsza === null ? cena_wywolawcza : najwyzsza + krok`
  - `komunikatLicytacji(e: unknown): string` — `ZA_MALO` → „Ktoś Was uprzedził albo kwota za mała. Odśwież.”, `JUZ_PROWADZICIE` → „Prowadzicie - nie przebijacie samych siebie.”, `BRAK_PUNKTOW` → „Za mało wolnych punktów (część trzymają Wasze prowadzące oferty).”, `LICYTACJA_NIEAKTYWNA` → „Licytacja jest zamknięta albo jeszcze się nie zaczęła.”, `NIE_KAPITAN` → „Licytuje kapitan drużyny.”, inne → „Coś poszło nie tak. Spróbuj jeszcze raz.”
  - `<KartaLicytacji licytacja={LicytacjaWidok} krok={number} mojaDruzyna={string|null} jestKapitanem={boolean} druzynyNaKlatwe={Team[]} />`

- [ ] **Step 1: Unit test `tests/lib/licytacje.test.ts`** — `minimalnaOferta` (bez ofert → cena wywoławcza; z ofertą 100 i krokiem 10 → 110) i `komunikatLicytacji` (każdy kod → tekst powyżej). Run → FAIL.
- [ ] **Step 2: Implement `src/lib/licytacje.ts`**, run → PASS.
- [ ] **Step 3: Page** — nagłówek „Licytacje”, karta salda: „Saldo drużyny” i „Wolne do licytowania” (`dostepne_saldo`); sekcje „Trwają”, „Wkrótce”, „Zakończone”; organizator bez drużyny i osoba bez drużyny — wzorem obecnego `page.tsx` (podgląd bez przycisków). `krok` z `app_settings.licytacja_krok`.
- [ ] **Step 4: `KartaLicytacji`** — grafika (`grafika` → publiczny URL bucketu `przedmioty`; brak → `IkonaPozycji` z `ikona`; `w_ciemno` przed zamknięciem → karta „Tajemnicza nagroda” z ikoną znaku zapytania); najwyższa oferta + kolor/nazwa drużyny; licznik do `koniec` (po zerze „Zamykanie…”); dla kapitana pole liczbowe z `minimalnaOferta` i przycisk „Licytuj”; „Wkrótce” — licznik do `start`; zamknięta — „Wygrywa <drużyna> za X pkt” / „Bez zwycięzcy”; zamknięta Klątwa wygrana przez moją drużynę z zamówieniem bez celu (pole `order_id` + status zamówienia — dociągnij w page z `shop_orders` dla mojej drużyny) → select drużyny jawnej ≠ moja i przycisk „Rzuć klątwę” (`rzuc_klatwe`).
- [ ] **Step 5: `LicytacjeNaZywo`** — kanał realtime wzorem `src/app/app/RankingNaZywo.tsx` (`postgres_changes_options: { wait: true }`) na INSERT `licytacje_oferty` i UPDATE `licytacje` → `router.refresh()`; plus `OdswiezPrzyPowrocie` (istniejący komponent).
- [ ] **Step 6: Nawigacja** — w `PasekNawigacji.tsx` etykieta pozycji `/app/sklep` → „Licytacje” (href bez zmian).
- [ ] **Step 7: `npx tsc --noEmit -p .` i `npx eslint src`** → bez błędów; `npx vitest run tests/lib/licytacje.test.ts` → PASS.
- [ ] **Step 8: Commit** — „Licytacje: ekran uczestników zamiast sklepiku”

### Task 4: Panel admina — wystawianie i obsługa

**Files:**
- Modify: `src/app/app/admin/sklepik/page.tsx` (tytuł „Licytacje”; sekcje: Nowa licytacja, Trwające i zapowiedziane, Kolejka wydań, Klątwy czekające na ofiarę), `src/app/app/admin/page.tsx` (opis kafelka)
- Create: `src/app/app/admin/sklepik/NowaLicytacja.tsx`, `src/app/app/admin/sklepik/ObslugaLicytacji.tsx`, `src/app/app/admin/sklepik/KlatwaZaKapitana.tsx`
- Keep: `DecyzjaZamowienia.tsx` (kolejka wydań nagród fizycznych bez zmian); `StanPozycji.tsx` usunąć z widoku, jeśli dotyczy tylko stanu półki/ceny

**Interfaces:**
- Consumes: tabele `licytacje`, `shop_items` (RLS admin), bucket `przedmioty`, `rzuc_klatwe`
- Produces: brak nowych interfejsów dla innych zadań

- [ ] **Step 1: `NowaLicytacja`** — przełącznik „Przedmiot z katalogu” (select `shop_items`) / „Nowy przedmiot” (nazwa, opis, plik grafiki → upload `przedmioty/<uuid>.<ext>`, insert `shop_items` z `kind='physical'`, `price = cena wywoławcza`, `grafika = ścieżka`, `active = true`); dla przedmiotu z katalogu opcjonalna podmiana grafiki (update `shop_items.grafika`); pola: cena wywoławcza (liczba > 0), otwarcie („od razu” / data-godzina lokalna Europe/Warsaw), zamknięcie (data-godzina, > otwarcie), przełącznik „W ciemno”; insert do `licytacje` z `created_by`. Walidacja w kliencie + błędy bazy po polsku.
- [ ] **Step 2: `ObslugaLicytacji`** — dla `status='trwa'`: „Zmień zamknięcie” (update `koniec`), „Anuluj” (confirm → update `status='anulowana'`); pokazuje najwyższą ofertę i drużynę.
- [ ] **Step 3: `KlatwaZaKapitana`** — lista zamówień `pending` z przedmiotem `effect_key='klatwa'` i `target_team_id is null`: drużyna zwycięzcy, select ofiary (jawne drużyny ≠ zwycięzca), „Rzuć w imieniu kapitana” → `rzuc_klatwe`. Kolejka wydań (`DecyzjaZamowienia`) ma wykluczać te zamówienia (filtr po `effect_key`/`target_team_id`).
- [ ] **Step 4: `npx tsc --noEmit -p .`, `npx eslint src`** → bez błędów.
- [ ] **Step 5: Commit** — „Licytacje: panel admina (wystawianie, anulowanie, Klątwa za kapitana)”

### Task 5: Sprawdzenie na żywo i wdrożenie

**Files:** brak nowych (skrypt e2e w scratchpadzie, nie w repo)

- [ ] **Step 1: Pełne testy** — `npx vitest run` → wszystkie PASS (przy błędach logowań poczekać 5 min i powtórzyć — limit logowań bazy testowej).
- [ ] **Step 2: E2E na bazie testowej** — `next dev -p 3300` z kluczami `TEST_*`, puppeteer (wzór: scratchpad `mapa/post-e2e.mjs`): admin wystawia licytację z katalogu (otwarcie od razu, zamknięcie za 2 min), kapitan A licytuje cenę wywoławczą, kapitan B przebija, ekran A pokazuje nowego lidera bez ręcznego odświeżania (realtime), `licytacje_tick()` po czasie → karta „Wygrywa B”; zrzuty ekranu ekranu uczestnika i panelu.
- [ ] **Step 3: `npx next build`** → sukces.
- [ ] **Step 4: Prod** — `npx supabase link --project-ref tjjlslupthlylnxvfroz && npx supabase db push; npx supabase link --project-ref cmuyeoobmidawmyxwihk` (jedna komenda); sprawdzić `cron.job` zawiera `licytacje`.
- [ ] **Step 5: Push** — `git push`; potwierdzić `git ls-remote origin refs/heads/main`.
