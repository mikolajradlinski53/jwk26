# Sklepik — spec projektowy

Data: 2026-09-25
Status: zatwierdzony do implementacji
Poprzedza: plan 06

## 1. Czym to jest

Półka, z której **kapitan** kupuje za saldo drużyny: rzeczy fizyczne do wydania
przez admina (alkohol, jedzenie, przekąski) oraz trzy perki cyfrowe, które
realnie ruszają punktami.

To jest **pierwsze wyjście punktów z systemu**. Do dziś ledger tylko rośnie:
bingo dosypuje, admin dosypuje, nic nie odejmuje. Bez sklepiku ranking jest
licznikiem, a nie ekonomią — punkty nie mają na co się wydać, więc zdobywanie
ich nie kosztuje żadnej decyzji.

Krok 5 z §9 speca głównego (`2026-09-14-sekta-wyjazdowa-design.md`), rozszerzony
o semantykę perków, której tamten spec nie rozstrzygał: wprowadzał
`active_effects.effect_key`, ale nigdy nie mówił, kto ten klucz wykonuje.

## 2. Zakres

**W zakresie:**

- półka z pozycjami fizycznymi i cyfrowymi, zasiana migracją
- zakup jedną funkcją `SECURITY DEFINER`, z blokadą salda i stanu magazynu
- trzy perki mechaniczne: błogosławieństwo, klątwa, tarcza
- kolejka wydań w panelu admina, z anulowaniem i zwrotem punktów
- jawna kronika zakupów, widoczna dla wszystkich
- wybór kapitana w panelu admina
- licznik nowych zamówień w Sanktuarium, odświeżany realtime
- tabela `powiadomienia` jako szuflada pod krok 8

**Poza zakresem, świadomie:**

- **Transport powiadomień** (web push, SMS) — krok 8, osobny spec. Zakup dopisuje
  wiersz do outboxu, ale nic go nie opróżnia. Admin dowiaduje się o zamówieniu,
  kiedy ma apkę otwartą.
- **Edytor pozycji w panelu** — półkę zasiewa migracja (D8).
- **Efekty dotykające kasyna** — kasyno nie istnieje (D5).
- **Zakupy indywidualne** — saldo osoby zostaje nietknięte, wydaje się wyłącznie
  z salda drużyny. Tak stanowi D2 speca głównego.
- **Warstwa wizualna** — ekrany powstają w tej samej surowej konwencji co
  `/app/bingo` i `/app/admin/*`. Front-end to osobny, duży plan.

## 3. Decyzje

### D1. Kupuje wyłącznie kapitan, a kapitana ustawia admin

`teams.captain_id` istnieje od pierwszej migracji i **nic w aplikacji go nie
czyta ani nie ustawia** — `grep` po `src/` daje jedno trafienie, w `types/db.ts`.
Reguła „kupuje tylko kapitan" nie ma więc dziś jak zaistnieć.

Dlatego częścią tego kroku jest ekran `/app/admin/druzyny`: lista drużyn, przy
każdej wybór kapitana z jej członków. Polityka `teams_admin_write` już istnieje,
więc wystarczy `UPDATE` przez RLS — żadnej nowej funkcji.

**Dlaczego admin, a nie głosowanie drużyny:** kapitan to rola z władzą nad
wspólnym saldem, nadana przed wyjazdem razem z podziałem na drużyny. Wybory
w apce to osobny mechanizm z osobnymi nadużyciami, a rozstrzyga je jedno
kliknięcie osoby, która i tak przypisuje drużyny.

### D2. Saldo serializuje blokada wiersza `teams`

Salda nie da się zablokować, bo to `SUM(delta)` z księgi, nie kolumna. Funkcja
zakupu robi więc `select ... from teams where id = v_team for update`, i dopiero
potem liczy saldo i dopisuje wpis.

**Dlaczego:** bez tego dwa zakupy tego samego kapitana — dwa kliknięcia w słabym
zasięgu, albo dwa otwarte ekrany — czytają to samo saldo i oba przechodzą.
Drużyna schodzi pod zero i nie ma jak tego cofnąć, bo ledger jest tylko do
dopisywania. To ten sam idiom, którym `review_bingo` rozbraja dwóch adminów
klikających jedno zgłoszenie.

### D3. Klątwa blokuje dwa wiersze, w kolejności po `id`

Klątwa dotyka dwóch drużyn: kupującej (płaci) i ofiary (traci punkty, może zużyć
tarczę). Funkcja blokuje **oba** wiersze `teams`, posortowane po `id`.

**Dlaczego kolejność:** dwie drużyny klnące się wzajemnie w tej samej sekundzie
zablokowałyby wiersze w odwrotnym porządku i weszły w deadlock — Postgres ubiłby
jedną transakcję błędem, którego UI nie umie wytłumaczyć. Sortowanie po `id` daje
globalnie spójny porządek, więc druga transakcja po prostu czeka. Blokada ofiary
zamyka przy okazji drugi wyścig: dwie klątwy w tę samą drużynę nie zużyją jednej
tarczy dwa razy.

### D4. `active_effects` dostaje `consumed_at` i `order_id`

Odstępstwo od §4 speca głównego, który przewidywał tylko
`(id, scope, subject_id, effect_key, expires_at)`.

**Dlaczego:** wszystkie trzy perki są jednorazowe. Bez `consumed_at` zużyty efekt
albo nie kończy się nigdy, albo trzeba go usunąć — a usuwanie kasuje ślad, na
którym stoi cały ten schemat. Księga jest tylko do dopisywania właśnie po to, żeby
przy ognisku dało się odtworzyć, co się stało. `order_id` wiąże efekt z zakupem,
który go opłacił, i bez niego kronika nie umie pokazać, czyja była tarcza.

### D5. Efekty są mechaniczne, ale zaczepione wyłącznie o bingo

Baza wykonuje efekty sama, nie honoruje ich człowiek. Ale jedyny punkt
zaczepienia to `review_bingo` i funkcja zakupu — bo to jedyne miejsca, które
dziś istnieją.

**Dlaczego nie silnik generyczny pod kasyno:** kasyna nie ma, więc hooki pod nie
byłyby zgadywaniem, jak będzie wyglądać interfejs, którego jeszcze nikt nie
zaprojektował. Kasyno dostanie swoje efekty w swoim kroku, czytając z tej samej
tabeli.

### D6. Tarcza zamiast dyspensy

Rozważany był perk „zalicz pole bingo bez zdjęcia". Odrzucony:
`bingo_submissions.photo_path` jest `not null`, więc dyspensa wymagałaby zmiany
schematu **i** nowego gestu na planszy — osobnej ścieżki w UI, którą trzeba
osobno testować.

Tarcza („pochłania następną klątwę rzuconą w drużynę") mieszka w całości
w funkcji zakupu, nie dotyka schematu bingo i dopiero ona tworzy wyścig zbrojeń
klątwa↔tarcza — czyli powód, żeby kapitan patrzył na półkę częściej niż raz.

### D7. Kronika zakupów jest jawna globalnie

`shop_orders` czyta każdy zaakceptowany uczestnik, nie tylko własna drużyna.

**Dlaczego:** tabela ryzyk speca głównego wymaga „historia jawna dla drużyny"
jako rozbrojenia kapitana przepuszczającego dorobek. Globalna jawność spełnia to
z nawiązką i robi z klątwy **akt publiczny** — ofiara widzi, kto rzucił, i to jest
cała zabawa. Nic wrażliwego tu nie ma: to lista tego, co drużyna kupiła za punkty.
Dowody przelewu zostają zamknięte jak dotąd, bo to dane finansowe.

### D8. Półkę zasiewa migracja, nie edytor w panelu

Admin dostaje kolejkę wydań i przełącznik `active`/`stock`. Tworzenia
i edytowania pozycji nie dostaje.

**Dlaczego:** dokładnie tak samo zasiane są 4 drużyny i 25 zadań bingo. Ceny
i stany podmienia się jednym zapytaniem bez wdrożenia, a pełny CRUD to kilka
formularzy do napisania i przetestowania dla asortymentu, który zmieni się raz,
przed wyjazdem.

### D9. Anulowanie zwraca punkty

Admin może anulować zamówienie `pending`. Zwrot idzie **dodatnim wierszem**
w księdze, kategoria `sklepik_zwrot`, nie usunięciem wpisu.

**Dlaczego:** bez zwrotu pomyłka — złe kliknięcie, pozycja, której nie ma na
stanie fizycznie — jest nieodwracalna i kończy się kłótnią. Wiersz dodatni
zachowuje ślad obu zdarzeń.

Efekty cyfrowe **nie podlegają anulowaniu**, bo klątwa już zabrała ofierze punkty,
a cofanie jej wymagałoby cofania cudzego salda. Anulować da się wyłącznie
zamówienia `physical`.

### D10. Powiadomienia: outbox teraz, transport w kroku 8

Zakup dopisuje wiersz do `powiadomienia`. W tym kroku **nikt go nie opróżnia**.
Admin dowiaduje się o zamówieniu przez licznik w Sanktuarium, odświeżany realtime.

Licznik **nie czyta outboxu** — liczy zamówienia `pending` wprost z
`shop_orders`. To istotne: outbox zostanie kiedyś opróżniony i wtedy przestałby
być prawdą o kolejce.

Zakup dopisuje do outboxu dokładnie tyle: **jeden wiersz dla admina** przy każdym
zamówieniu, oraz **drugi, adresowany do drużyny-ofiary**, gdy zakupem była klątwa.
Ten drugi jest jedynym powodem, dla którego `adresat` ma wariant `team` — ofiara
dowie się o rzucie z powiadomienia, kiedy transport powstanie, a do tego czasu
z kroniki.

Licznik działa tym samym mechanizmem co `RankingNaZywo`: subskrypcja
`postgres_changes` na `INSERT` w `shop_orders`, sygnał „coś się zmieniło",
przeliczenie zapytaniem. Dwa warunki przeniesione z tamtej lekcji, oba
niewidoczne dla testów jednostkowych:

- `config.postgres_changes_options.wait: true` — bez tego `subscribe()` zgłasza
  gotowość, zanim serwer uruchomi subskrypcję na replikacji, i zdarzenie
  z pierwszych sekund ginie bez żadnego błędu u klienta.
- `alter publication supabase_realtime add table shop_orders` w migracji. Dziś
  w publikacji jest wyłącznie `points_ledger`. Bez tej linii licznik nie drgnie
  nigdy, a kod klienta będzie wyglądał poprawnie.

**Dlaczego nie prawdziwy push teraz:** funkcja w bazie nie umie wysłać pusha,
więc transport to `pg_net` albo Edge Function, klucz VAPID w sekretach, service
worker i zgoda w UI. Tego nie da się zweryfikować z wiersza poleceń — tylko na
telefonie. Zbudowany raz w kroku 8 obsłuży naraz sklepik, kolejkę bingo,
rejestracje i broadcast; zbudowany teraz pod jeden przypadek zostanie przepisany.

## 4. Model danych

```
shop_items      id, name, description, kind ('digital'|'physical'),
                price, stock, active, effect_key, effect_value,
                effect_hours, requires_target, position
                → CHECK (kind = 'digital') = (effect_key is not null)
                → stock NULL = bez limitu

shop_orders     id, team_id, item_id, price_paid, ordered_by → profiles,
                target_team_id → teams, status ('pending'|'fulfilled'|'cancelled'),
                fulfilled_by, fulfilled_at, note, created_at

active_effects  id, scope ('user'|'team'), subject_id, effect_key, effect_value,
                expires_at, consumed_at, order_id → shop_orders, created_at

powiadomienia   id, kanal ('in_app'|'push'|'sms'), adresat ('admin'|'team'|'user'),
                adresat_id, tytul, body, ref_type, ref_id, created_at, wyslane_at
```

`price_paid` jest snapshotem — cena pozycji może się zmienić, a kronika i zwrot
muszą operować na tym, co realnie zapłacono. Ta sama zasada, co `team_id`
w księdze (D2 speca głównego).

`requires_target` jest **kolumną, nie regułą w kodzie klienta**. Front-end pokazuje
wybór drużyny, bo pozycja tak mówi, a nie bo ktoś zaszył w komponencie, że klątwa
jest szczególna. Kolejny perk z celem nie wymaga wtedy zmiany w UI.

Nowe kategorie w księdze: `sklepik` (wydatek), `sklepik_zwrot` (anulowanie),
`klatwa` (strata ofiary). `points_ledger.category` jest zwykłym `text`, więc
żadnego `ALTER TYPE` nie potrzeba.

## 5. Półka

Skala jest zadana przez bingo: zadanie domyślnie 20 pkt, dwanaście linii po 50,
pełna plansza 200 — **maksimum dla drużyny to 1300**, realnie kilkaset. Cennik
siedzi więc w przedziale 35–250, żeby drużyna kupiła kilka rzeczy przez cały
wyjazd, a nie jedną albo dwadzieścia.

### Fizyczne

| pozycja | co przyjdzie | cena | stan |
|---|---|---|---|
| Woda Święcona | 0,5 l wódki | 250 | 4 |
| Manna | pizza dowieziona dla drużyny | 220 | 4 |
| Napar Braterski | sześciopak piwa | 180 | 6 |
| Krew Ofiarna | 0,7 l wina | 160 | 6 |
| Namaszczenie | shot dla każdego w drużynie | 120 | 8 |
| Chleb Powszedni | paczka przekąsek | 50 | 20 |
| Kielich | jedno piwo | 40 | 40 |
| Eliksir Czuwania | energetyk | 35 | 20 |

### Cyfrowe

| pozycja | cena | `effect_key` | działanie |
|---|---|---|---|
| Błogosławieństwo | 120 | `blogoslawienstwo` | ×2 punkty za następne przyjęte zdjęcie, ważne 3 h |
| Klątwa | 200 | `klatwa` | wskazana inna drużyna traci 50 pkt, natychmiast |
| Tarcza | 150 | `tarcza` | pochłania następną klątwę rzuconą w drużynę |

Cyfrowe mają `stock = NULL` (bez limitu). Fizyczne mają stan skończony i to jest
celowe: ostatnia butelka ma być wyścigiem.

Rejestr nazw jest liturgiczny, opis pod nazwą mówi wprost, co przyjdzie — komizm
bierze się z kontrastu formy z treścią, jak w zadaniach bingo.

## 6. Efekty i ich konsumpcja

### Błogosławieństwo

Zakup zapisuje `active_effects` ze `scope='team'`, `expires_at = now() + 3h`.

Konsumuje **`review_bingo`**, przy akceptacji: szuka dla drużyny niezużytego,
nieprzedawnionego efektu `blogoslawienstwo`, blokuje go `for update skip locked`,
mnoży punkty zadania przez `effect_value` i ustawia `consumed_at`.

Mnożnik dotyczy **wyłącznie punktów za zadanie**, nie bonusów za linię i planszę.
Bonus jest zasługą zbiorową przyznawaną raz na linię; podwojenie go zależałoby od
kolejności akceptacji, czyli od tego, kogo admin kliknął pierwszego.

Wpis w księdze mówi w `reason`, że punkty były podwojone. Księga jest jawna,
a niewyjaśniona czterdziestka przy ognisku to gotowa kłótnia.

Odrzucenie zgłoszenia nie zużywa niczego.

### Klątwa

Rozstrzyga się w całości w funkcji zakupu, nie zostawia wiersza w
`active_effects` — poza jednym przypadkiem: jeśli ofiara ma tarczę, klątwa ją
zużywa (`consumed_at`) i **nie odejmuje punktów**. Zamówienie i tak powstaje ze
statusem `fulfilled`, a `note` mówi, że tarcza pochłonęła rzut. Kupujący traci
punkty — za rozpoznanie, kto ma tarczę, płaci się z góry.

Cel musi być inną drużyną. Klątwa na siebie odbija się błędem.

### Tarcza

Zakup zapisuje `active_effects` ze `scope='team'` i `expires_at = NULL` — trwa,
aż ją coś zużyje. Konsumuje ją funkcja zakupu cudzej klątwy (wyżej).

Druga tarcza kupiona przy aktywnej pierwszej po prostu leży obok; klątwa zużywa
jedną. Blokowanie zakupu duplikatu wymagałoby unikalnego indeksu warunkowego
i komunikatu w UI dla oszczędności, której nikt nie oczekuje.

## 7. Przepływy

**Zakup:** kapitan wybiera pozycję → (dla `requires_target`) wskazuje drużynę →
`kup_z_polki()` w jednej transakcji: sprawdza approved, sprawdza że to kapitan
**tej** drużyny, blokuje wiersz drużyny (i ofiary, D3), blokuje wiersz pozycji,
sprawdza `active`, stan i saldo, dopisuje ujemny wiersz do księgi, tworzy
zamówienie, zmniejsza stan, wykonuje efekt albo zostawia status `pending`, dopisuje
wiersz do outboxu → `router.refresh()` w kliencie.

**Wydanie:** admin widzi kolejkę `pending` (tylko `physical`) → `wydaj_zamowienie()`
ustawia `fulfilled`, `fulfilled_by`, `fulfilled_at`.

**Anulowanie:** admin → `anuluj_zamowienie()` ustawia `cancelled`, oddaje stan na
półkę i dopisuje dodatni wiersz `sklepik_zwrot`.

**Kapitan:** admin w `/app/admin/druzyny` wybiera kapitana z członków drużyny →
`UPDATE teams` przez RLS.

## 8. Bezpieczeństwo

- `INSERT`/`UPDATE`/`DELETE` na `shop_orders`, `active_effects` i `points_ledger`
  zamknięte dla `authenticated`. Jedyne wejście to trzy funkcje `SECURITY DEFINER`,
  każda sprawdzająca uprawnienie **ręcznie** — `SECURITY DEFINER` omija RLS, więc
  brak tego sprawdzenia oznaczałby, że kupuje każdy.
- Nowy pomocnik `public.is_captain(p_team uuid)`, w tej samej konwencji co
  istniejące `is_admin()` i `is_approved()`: `stable`, `security definer`,
  `set search_path = ''`. Sprawdza, że `auth.uid()` jest kapitanem **wskazanej**
  drużyny. Osobna funkcja, a nie warunek wklejony w `kup_z_polki()`, bo ten sam
  warunek trafi kiedyś do polityk RLS i do kasyna.
- `shop_items` i `shop_orders`: `SELECT` dla zaakceptowanych (D7).
- `active_effects`: `SELECT` dla zaakceptowanych. Nie ma tu nic do ukrycia —
  wiedza, że ktoś ma tarczę, jest częścią gry, a wpis w kronice i tak ją zdradza.
- `powiadomienia`: `SELECT` wyłącznie dla admina. Adresowane do admina, więc
  uczestnik nie ma powodu ich czytać.
- `stock` z `CHECK (stock is null or stock >= 0)` — twardy backstop, gdyby
  arytmetyka w funkcji kiedykolwiek się pomyliła.

## 9. Ekrany

| trasa | zawartość |
|---|---|
| `/app/sklep` | saldo drużyny, półka, aktywne efekty drużyny, kronika. Zakup w komponencie klienckim przez `rpc` + `router.refresh()`, jak `DecyzjaBingo` |
| `/app/admin/sklepik` | kolejka wydań, wydanie i anulowanie, przełącznik `active`/`stock` |
| `/app/admin/druzyny` | wybór kapitana, saldo drużyny |
| `/app/admin` | dwa nowe wejścia i licznik `pending` przy Sklepiku |

Nie-kapitan widzi całą półkę i ceny, ale zamiast przycisku zakupu ma nazwę
kapitana. Ukrywanie asortymentu przed drużyną sprawiłoby, że nikt nie naciska na
kapitana, żeby coś kupił — a to jest mechanika społeczna, na której to stoi.

## 10. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Drużyna schodzi pod zero | Blokada wiersza `teams` przed odczytem salda (D2) |
| Ostatnia sztuka sprzedana dwa razy | Blokada wiersza pozycji + `CHECK (stock >= 0)` |
| Deadlock przy wzajemnych klątwach | Blokowanie dwóch wierszy w kolejności po `id` (D3) |
| Jedna tarcza pochłania dwie klątwy | Blokada wiersza ofiary obejmuje jej efekty (D3) |
| Uczestnik kupuje fetchem z konsoli | Zapis tylko przez `SECURITY DEFINER` z ręcznym `is_captain` |
| **Podmiana `review_bingo` gubi bonusy** | Funkcja jest podmieniana przez `create or replace`, więc całe ciało trzeba przenieść wiernie. Testy bonusów za linię i planszę muszą przejść **po** migracji, nie tylko przed |
| Zamówienie leży godzinami niezauważone | Licznik realtime w Sanktuarium; pełne powiadomienia w kroku 8 (D10) |
| Cennik oderwany od zarobków | Skala wyliczona z bingo (§5), wartości w `shop_items` do podmiany zapytaniem |

## 11. Kryteria ukończenia

1. Nie-kapitan nie kupi — funkcja odbija, a UI nie pokazuje mu przycisku.
2. Kapitan nie kupi ponad saldo drużyny.
3. Dwa równoległe zakupy na granicy salda: jeden przechodzi, drugi odbija.
4. Stan schodzi do zera i dalsze zakupy odbijają się błędem.
5. Klątwa zabiera ofierze punkty i widać ją w kronice u wszystkich.
6. Klątwa w drużynę z tarczą zużywa tarczę i **nie** zabiera punktów.
7. Klątwa na własną drużynę odbija się błędem.
8. Błogosławieństwo podwaja punkty dokładnie jednego przyjętego zdjęcia,
   nie rusza bonusów za linię, i nie działa po trzech godzinach.
9. Bezpośredni `INSERT` do `shop_orders` z klucza `anon` pada na RLS.
10. Anulowanie zamówienia oddaje punkty i stan; anulowanie pozycji `digital`
    odbija się błędem.
11. Bonusy za linię i pełną planszę działają po podmianie `review_bingo`.
12. Admin ustawia kapitana i zakup zaczyna działać dla wskazanej osoby.
13. Licznik przy Sklepiku rośnie w otwartym Sanktuarium **bez odświeżania**,
    w drugiej karcie — sprawdzane w przeglądarce, bo testy DB tego nie widzą.
