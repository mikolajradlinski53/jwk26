# Sloty — spec projektowy

Data: 2026-09-25
Status: zatwierdzony do implementacji
Poprzedza: plan 07

## 1. Czym to jest

Jednoręki bandyta na trzech bębnach, grający przeciwko **saldu indywidualnemu**
gracza. Pierwsza z trzech gier kasyna i jedyna w tym kroku.

Sloty stawiają całą instalację, z której skorzystają pozostałe dwie:
`game_sessions`, limit obrotu, losowanie po stronie bazy i wpisy do księgi
z kategorii `kasyno`. Blackjack i dino wchodzą potem na gotowy fundament,
każde z własnym specem.

Krok 6 z §9 speca głównego (`2026-09-14-sekta-wyjazdowa-design.md`), **zawężony
do pierwszej gry**. Tamten spec wymienia „sloty → blackjack → dino" jako jeden
krok; rozbicie jest świadome, bo trzy gry mają trzy różne ryzyka i nie ma powodu,
żeby dzieliły jedno wdrożenie.

## 2. Zakres

**W zakresie:**

- trzy bębny po sześć symboli, losowane w bazie
- tabela wypłat strojona przez `app_settings`, bez wdrożenia
- limit obrotu w ruchomym oknie 24 godzin
- `game_sessions` z zapisem każdego spinu, z `state` nieczytelnym dla nikogo
- jeden wpis netto do księgi na spin, na `user_id`
- ekran `/app/arcade` z bębnami i własną historią
- przeniesienie ikony półki do `src/components/`

**Poza zakresem, świadomie:**

- **Blackjack** — osobny spec. Stan wielotursowy i szczelność talii to inna klasa
  problemu niż jeden atomowy spin.
- **Dino** — osobny spec, jeśli w ogóle. Gra umiejętnościowa w przeglądarce
  oznacza, że wynik zgłasza niezaufany klient; tego nie da się zweryfikować,
  można tylko ograniczyć skutek sufitem wypłat.
- **Wybór stawki** — stawka jest stała (D2).
- **Darmowe spiny, linie wypłat, bonusy** — jedna linia, jeden spin, jedna
  wypłata. Każda z tych rzeczy mnoży tabelę wypłat i nie dodaje nic do zabawy
  przy trzech dniach grania.
- **Warstwa wizualna** — ekran powstaje w tej samej surowej konwencji co reszta
  `/app`.

## 3. Decyzje

### D1. Limit obrotu liczy ruchome 24 godziny, nie dobę kalendarzową

`SUM(stake) WHERE created_at > now() - interval '24 hours'`.

**Dlaczego:** daty w `app_settings` mówią, że wyjazd trwa **23–25 października
2026**, a czas letni w Polsce kończy się w ostatnią niedzielę października —
czyli **25 października 2026, w ostatnią noc wyjazdu**. Doba kalendarzowa tego
dnia ma 25 godzin, a godzina 2:00–3:00 zdarza się dwa razy. Każda arytmetyka
zakładająca dobę równą 24 godzinom jest wtedy o godzinę nie ta.

Okno ruchome liczy czas absolutny, więc zmiana strefy go nie dotyczy. Przy okazji
znika drugi problem: doby kalendarzowej nie da się grać przez odczekanie do
północy i wyczerpanie dwóch limitów w ciągu godziny.

### D2. Stawka nie jest parametrem funkcji

`zakrec_slotami()` nie przyjmuje stawki. Czyta ją z `app_settings`.

**Dlaczego:** to najtańsze możliwe zamknięcie najtańszego oszustwa. Parametr
trzeba by walidować — sprawdzać zakres, typ, znak, zgodność z limitem — a każde
takie sprawdzenie to miejsce na pomyłkę. Brak parametru nie ma jak być
zwalidowany źle.

Konsekwencja, którą przyjmujemy: gracz nie może podnieść stawki, żeby zagrać
o więcej. Przy limicie obrotu 300 punktów wybór stawki i tak byłby tylko wyborem
tempa, a nie skali.

### D3. `state` jest nieczytelny dla nikogo, od pierwszego dnia

`REVOKE SELECT on game_sessions from authenticated`, potem
`GRANT SELECT (id, user_id, game, stake, payout, status, created_at)`.

Granty kolumnowe, ten sam idiom, którym `profiles` broni się przed podniesieniem
sobie `role='admin'`.

**Dlaczego teraz, a nie przy blackjacku:** to blackjack wsadzi do `state`
nierozdane karty i wtedy odczyt tej kolumny stanie się podglądaniem następnej
karty. Ustawienie polityki dopiero wówczas wymagałoby wrócenia do tej tabeli
i pamiętania, dlaczego. Zamknięte od początku nie wymaga pamiętania niczego,
a slotom nic nie odbiera: po rozliczeniu spinu w `state` nie ma nic tajnego.

Granty kolumnowe działają **na rolę, nie na politykę**, więc obejmują też admina.
Admin, który będzie musiał obejrzeć `state` przy sporze, zrobi to kluczem
serwisowym z panelu Supabase, nie z aplikacji.

### D4. Jeden wpis netto do księgi na spin

`delta = payout - stake`, kategoria `kasyno`. Przy wyniku zerowym wpis **nie
powstaje wcale**.

**Dlaczego:** szacunek jest prosty — 60 osób × 30 spinów × 3 dni to 5400 spinów.
Przy dwóch wpisach na spin (stawka i wypłata) daje to 10 800 wierszy w księdze,
które zatopiłyby `/app/admin/historia` i uczyniłyby ją bezużyteczną dokładnie
wtedy, kiedy będzie potrzebna. Stawka i wypłata z osobna zostają w
`game_sessions`; księga mówi o zmianie salda.

Para zwraca dokładnie stawkę, więc 42% spinów nie zostawia w księdze nic. To jest
w porządku — zapis maszyny istnieje niezależnie.

### D5. Losuje baza, przegląda przeglądarka

`random()` w funkcji `SECURITY DEFINER`. Klient dostaje gotowy wynik i tylko go
odsłania.

**Dlaczego:** losowanie w przeglądarce oznaczałoby, że wynik zgłasza gracz —
a wtedy cała tabela wypłat jest dekoracją. To ta sama zasada, która trzyma
punkty w bazie (D1 speca głównego).

### D6. Saldo indywidualne zamyka blokada wiersza `profiles`

Funkcja blokuje wiersz gracza (`for update`), potem liczy `SUM(delta)`.

**Dlaczego:** dokładnie ten sam wyścig co w sklepiku i to samo rozbrojenie. Dwa
spiny wypuszczone równolegle przy saldzie na jeden odczytałyby to samo saldo i
oba przeszły. Sprawdzone tam testem, który to wykazał.

### D7. `game_sessions` dostaje kolumnę `payout`

Odstępstwo od §4 speca głównego, który przewiduje
`(id, user_id, game, state jsonb, stake, status, created_at)`.

**Dlaczego:** bez niej wypłata istnieje wyłącznie w księdze, i to w postaci
netto. Przy sporze „automat mnie oszukał" nie ma czego pokazać obok wylosowanych
symboli. Maszyna musi mieć własny, kompletny zapis tego, co zrobiła.

### D8. `slots_rtp` znika z ustawień

Zasiane w pierwszej migracji `slots_rtp = 0.88` zostaje **usunięte**, a w jego
miejsce wchodzą `slots_stawka` i `slots_wyplaty`.

**Dlaczego:** RTP nie jest pokrętłem, jest **konsekwencją** tabeli wypłat. Wiersz,
który wygląda na nastawę, a którego nikt nie czyta i którego zmiana nic nie robi,
to pułapka gorsza niż jego brak — pierwsza osoba, która zmieni go na 0.95,
uzna, że coś ustawiła. Zamiast tego strojone są prawdziwe pokrętła, a wzór na RTP
jest zapisany w §5 i w komentarzu migracji, żeby dało się przeliczyć po zmianie.

### D9. Losowanie i rozstrzyganie to dwie osobne funkcje

Trzy funkcje, nie jedna:

- `losuj_bebny()` → `text[]` — nieczysta, trzy razy `random()`, nic więcej
- `rozstrzygnij_bebny(p_bebny text[])` → `integer` — **czysta**, zwraca wypłatę
  dla podanych bębnów, czyta tabelę wypłat z `app_settings`
- `zakrec_slotami()` → składa je razem i robi całą resztę: uprawnienia, blokady,
  limit, saldo, zapis, księga

**Dlaczego:** bez tego podziału dwa kryteria ukończenia są niesprawdzalne.
Kryterium 8 wymaga potwierdzenia, że trójka Oka płaci 400 — przez **ustawienie**
bębnów, nie przez czekanie, aż wypadną, bo to jest raz na 216 spinów.
Kryterium 12 wymaga dziesięciu tysięcy losowań, a każdy spin przez
`zakrec_slotami()` kosztuje punkty i zjada limit obrotu; dziesięć tysięcy spinów
jest fizycznie niewykonalne.

Rozdzielone: `rozstrzygnij_bebny(array['oko','oko','oko'])` sprawdza tabelę wypłat
w jednym wywołaniu bez grosza obrotu, a `losuj_bebny()` da się wywołać dziesięć
tysięcy razy jednym `generate_series`.

Obie pomocnicze dostają `grant execute` roli `authenticated` mimo że gracz nie ma
powodu ich wołać — `rozstrzygnij_bebny` nie zmienia niczego i nie ujawnia niczego,
czego nie ma w tabeli wypłat, a `losuj_bebny` bez zapisu do księgi jest
generatorem liczb losowych bez konsekwencji. Zamykanie ich wymagałoby osobnej roli
dla testów, która sama byłaby większym ryzykiem niż to, co zamyka.

## 4. Model danych

```
game_sessions   id, user_id → profiles, game text, stake integer,
                payout integer, state jsonb, status text,
                created_at timestamptz
                → SELECT zabrany roli authenticated; grant kolumnowy bez `state`
                → index (user_id, created_at desc) pod okno 24 h

app_settings    slots_stawka    '10'
                slots_wyplaty   '{"trojka_oko": 400, "trojka": 120, "para": 10}'
                casino_daily_stake_cap  '300'   (już zasiane)
                — usuwane: slots_rtp
```

`game` i `status` są zwykłym `text`, nie enumami: kolejne gry dopisują tu własne
wartości i nie ma powodu, żeby każda z nich wymagała `ALTER TYPE` w migracji.
Sloty używają dokładnie dwóch: `game = 'sloty'`, `status = 'settled'` — spin
rozlicza się w tej samej transakcji, w której powstaje, więc stan nierozliczony
dla slotów nie istnieje. Blackjack dopisze `'w_toku'`.

`state` dla slotów trzyma wylosowane symbole: `{"bebny": ["oko","swieca","oko"]}`.
Nic tajnego, ale mieszka w kolumnie zamkniętej (D3), więc historia gracza czyta
symbole z widoku `moje_spiny`, nie z tabeli.

Widok `moje_spiny` jest jedynym miejscem, w którym symbole wychodzą do gracza.
Definiowany **bez** `security_invoker`, czyli prawami właściciela — inaczej nie
obejdzie grantu kolumnowego, który zabiera `state`. To odwrotnie niż `team_scores`
i `kronika_sklepiku`, i dlatego widok filtruje `user_id = auth.uid()` **we własnym
ciele**: przy prawach właściciela RLS tabeli bazowej go nie chroni, więc ten jeden
warunek jest całą ochroną cudzej historii.

Nowa kategoria w księdze: `kasyno`. `points_ledger.category` jest zwykłym `text`,
więc `ALTER TYPE` nie jest potrzebny.

## 5. Automat

Trzy bębny, sześć symboli, rozkład jednostajny i niezależny na każdym bębnie.
Symbole: **Oko** (najwyższy), Świeca, Kielich, Sztylet, Pieczęć, Klucz.

216 kombinacji (6³), rozbite bez reszty:

| wynik | kombinacji | prawdopodobieństwo | wypłata |
|---|---|---|---|
| trzy Oka | 1 | 1/216 ≈ 0,46% | **400** |
| trzy inne jednakowe | 5 | 5/216 ≈ 2,31% | **120** |
| dokładnie para | 90 | 90/216 ≈ 41,67% | **10** (zwrot stawki) |
| trzy różne | 120 | 120/216 ≈ 55,56% | 0 |

Sprawdzenie zliczenia: trójek jest 6 (po jednej na symbol); par jest
6 × 3 × 5 = 90 (symbol powtórzony × wybór dwóch pozycji z trzech × symbol
odmienny); trójek różnych 6 × 5 × 4 = 120. Razem 6 + 90 + 120 = 216.

**Oczekiwany zwrot ze spinu:**

```
(1 × 400 + 5 × 120 + 90 × 10) / 216 = 1900 / 216 = 8,796 pkt
RTP = 8,796 / 10 = 0,8796 ≈ 88%
```

Oczekiwana strata to 1,204 pkt na spin, czyli **36,1 pkt na wyczerpanie
dziennego limitu** (30 spinów). Po zmianie którejkolwiek wypłaty przelicz tym
samym wzorem: `Σ(kombinacji × wypłata) / 216 / stawka`.

**Wpływ na ranking, świadomie przyjęty.** Kasyno jest netto **ujemne** — przy
5400 spinach zabiera z ekonomii około 6500 punktów. Ale jackpot je
redystrybuuje: szansa trafienia przy 90 spinach na osobę to około 34%, więc przy
sześćdziesięciu grających padnie go kilkanaście do dwudziestu razy, po 400 punktów.
Ranking będzie od tego drgał i to jest cena wybrana świadomie — wariant o niższym
rozrzucie był na stole i został odrzucony.

## 6. Limit obrotu

`casino_daily_stake_cap` = 300 punktów **obrotu**, nie straty. Liczony jako
`SUM(stake)` z `game_sessions` dla tego gracza w ostatnich 24 godzinach,
niezależnie od gry — więc kiedy dojdzie blackjack, limit będzie wspólny i nie
trzeba go dzielić.

Przy stawce 10 daje to 30 spinów. Funkcja odbija spin, który przekroczyłby limit,
zamiast go przycinać: częściowy spin nie istnieje.

## 7. Przepływy

**Spin:** gracz naciska → `zakrec_slotami()` w jednej transakcji: sprawdza
`is_approved`, sprawdza że gracz ma drużynę (księga wymaga `team_id`), blokuje
wiersz `profiles`, czyta stawkę i wypłaty z `app_settings`, liczy obrót z okna
24 h i odbija przy przekroczeniu, liczy saldo indywidualne i odbija przy
niedoborze, losuje trzy symbole, rozstrzyga wypłatę, zapisuje `game_sessions` ze
statusem `settled`, dopisuje wpis netto do księgi jeśli różny od zera, zwraca
symbole i wypłatę → klient odsłania bębny i woła `router.refresh()`.

**Historia:** gracz widzi własne spiny z widoku `moje_spiny`.

## 8. Bezpieczeństwo

- Jedyne wejście do zapisu to `zakrec_slotami()` jako `SECURITY DEFINER`, z ręcznym
  sprawdzeniem `is_approved()` — `SECURITY DEFINER` omija RLS, więc bez tego
  zakręciłby każdy zalogowany, także `pending`.
- `INSERT`/`UPDATE`/`DELETE` na `game_sessions` zamknięte dla `authenticated`.
- `SELECT` zawężony grantem kolumnowym bez `state` (D3).
- Cudzej historii gry broni **dwie różne rzeczy**, bo są dwie drogi odczytu:
  polityka RLS `user_id = auth.uid()` na tabeli (dla dozwolonych kolumn) oraz
  warunek w ciele widoku `moje_spiny` (który idzie prawami właściciela, więc RLS
  go nie dotyczy — §4). Pominięcie któregokolwiek z tych dwóch otwiera jedną
  z dróg i zamyka drugą, co jest najgorszym możliwym wynikiem: wygląda na
  zabezpieczone.
- Brak parametru stawki (D2).
- Limit obrotu sprawdzany w tej samej transakcji, w której powstaje wiersz, więc
  dwa równoległe spiny na granicy limitu nie przepchną obu.

## 9. Ekrany

| trasa | zawartość |
|---|---|
| `/app/arcade` | saldo indywidualne, bębny, przycisk, ile spinów zostało w oknie, własna historia |
| `/app/wiecej` | wejście do `/app/arcade` w miejscu dzisiejszej obietnicy „Kasyno i gossipy zamieszkają tutaj" |

Pasek nawigacji zostaje pięciopozycyjny. Kasyno wchodzi pod „Więcej", tak samo jak
panel admina — szósta pozycja zwęziłaby wszystkie do granicy celu dotykowego
44 px, a kasyno nie jest tym, po co apka jest otwierana.

Symbole bębnów rysowane w miejscu, konturowo, jak ikony paska i półki. Odsłanianie
bębnów jest animacją po znanym już wyniku i ustępuje przy `prefers-reduced-motion`.

**Porządki przy okazji:** `src/app/app/sklep/Ikona.tsx` przenosi się do
`src/components/IkonaPozycji.tsx`. Dziś panel admina importuje ją przez
`../../sklep/Ikona`, czyli sięga do wnętrza sąsiedniej trasy — a sloty dodają
trzecie miejsce, które potrzebuje rysowanych konturów.

## 10. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Gracz podmienia stawkę | Stawka nie jest parametrem (D2) |
| Gracz losuje sobie wynik | `random()` w funkcji w bazie (D5) |
| Podglądanie `state` (istotne przy blackjacku) | Grant kolumnowy bez `state`, od pierwszego dnia (D3) |
| Saldo schodzi pod zero | Blokada wiersza `profiles` przed odczytem salda (D6) |
| Dwa spiny przepychają limit | Limit liczony w tej samej transakcji, co wstawienie wiersza |
| Limit gubi się na zmianie czasu | Ruchome okno 24 h, czas absolutny (D1) |
| Księga tonie w spinach | Jeden wpis netto, zerowe pomijane (D4) |
| Zmiana wypłat psuje RTP po cichu | Wzór w §5 i w komentarzu migracji; `slots_rtp` usunięte, żeby nie kłamało (D8) |

## 11. Kryteria ukończenia

1. `pending` nie zakręci — funkcja odbija.
2. Niezalogowany nie wywoła funkcji (grant zabrany roli `anon`).
3. Gracz bez drużyny nie zakręci — księga wymaga `team_id`.
4. Spin przy saldzie mniejszym niż stawka odbija się.
5. Dwa równoległe spiny przy saldzie na jeden: jeden przechodzi, drugi odbija,
   saldo nie jest ujemne.
6. Po wyczerpaniu 300 punktów obrotu spin odbija się komunikatem o limicie.
7. Obrót starszy niż 24 godziny nie liczy się do limitu.
8. Trójka Oka wypłaca 400, inna trójka 120, para 10, trzy różne nic —
   sprawdzone przez ustawienie wyniku, nie przez losowanie.
9. Para nie zostawia wpisu w księdze, ale zostawia wiersz w `game_sessions`.
10. `select state from game_sessions` z klucza `anon` i z sesji gracza pada.
11. Gracz nie widzi cudzych spinów.
12. Rozkład jest jednostajny — dziesięć tysięcy losowań w bazie mieści się
    w granicach oczekiwanych dla 1/216 i 90/216.
