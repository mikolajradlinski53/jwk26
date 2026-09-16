# Bingo i feed — spec projektowy

Data: 2026-09-16
Status: zatwierdzony do implementacji
Poprzedza: plan 04

## 1. Czym to jest

Plansza bingo dla drużyn, wrzucanie zdjęć jako dowodów, kolejka akceptacji
i globalny strumień zaakceptowanych zdjęć z lajkami i komentarzami.

To jest **pierwsze prawdziwe źródło punktów** w aplikacji. Do dziś ranking
pokazuje zera, bo jedynym sposobem przyznania punktów jest ręczny wpis Kapłana.
Bingo wypełnia też dwie puste zakładki naraz: `/bingo` i `/feed`.

Krok 4 z §9 speca głównego (`2026-09-14-sekta-wyjazdowa-design.md`), rozszerzony
o warstwę społeczną, której w tamtym specu nie było.

## 2. Zakres

**W zakresie:**

- plansza 5×5 ze stanem osobnym dla każdej drużyny
- wrzucanie zdjęcia jako dowodu wykonania zadania
- kolejka akceptacji w panelu, obsługiwana przez **wielu adminów**
- punkty za zadanie oraz bonusy za linię i pełną planszę
- globalny feed zaakceptowanych zdjęć
- lajki i komentarze pod zdjęciami

**Poza zakresem, świadomie:**

- **Powiadomienia** o akceptacji i komentarzach — plan 08, osobny spec. Bez nich
  trzeba odświeżyć ekran, żeby zobaczyć zmianę.
- **Ranking lajków** — warstwa społeczna zostaje poza ekonomią (D1 niżej).
- **Sklepik, kasyno, harmonogram, mini-gra** — osobne specy, osobne plany.
- **Landing page** — odłożony na wyraźną prośbę.

## 3. Decyzje

### D1. Lajki i komentarze nie dają punktów

Reakcje społeczne nie ruszają księgi. Punkty przyznaje wyłącznie akceptacja
zadania przez admina.

**Dlaczego:** sześćdziesiąt pięć osób, które się znają, na jednym wyjeździe.
Zmowa „lajkuję twoje, ty moje" byłaby banalna i nie do wykrycia, a ranking
przestałby cokolwiek znaczyć. Zabawa społeczna ma być zabawą, nie ekonomią.

### D2. Zatwierdza wielu adminów, nie jeden Kapłan

Rola `admin` istnieje od migracji 0001 i panel działa dla każdego, kto ją ma.
Przed wyjazdem nadajemy ją dwóm-trzem osobom z organizacji.

**Dlaczego:** cztery drużyny razy dwadzieścia pięć zadań to do stu zgłoszeń,
plus powtórki po odrzuceniach, w dużej części w nocy. Jedna osoba z telefonem
jest wąskim gardłem, a zamrożona kolejka zabija zabawę skuteczniej niż brak
funkcji. **Zero nowego kodu** — wystarczy `update profiles set role = 'admin'`.

Wyścig dwóch adminów nad tym samym zgłoszeniem rozbraja blokada wiersza
w funkcji rozpatrującej, tak samo jak przy rejestracjach: przegrany dostaje
czytelny komunikat zamiast cichej niespójności.

### D3. Autor może wycofać własne zgłoszenie, póki czeka

Unikalność `(team_id, task_id)` dla nieodrzuconych blokuje drugie zgłoszenie do
tego samego pola — i tak ma być, bo inaczej drużyna zasypałaby kolejkę
wariantami tego samego zadania.

Skutek uboczny jest jednak dotkliwy: **jeden kiepski wrzut blokuje całą drużynę**,
dopóki admin go nie odrzuci. Dlatego autor może usunąć własne zgłoszenie, póki
ma status `pending`. Zaakceptowanego nie ruszy nikt poza adminem.

**Odrzucenie zwalnia pole automatycznie** — warunek unikalności obejmuje wyłącznie
zgłoszenia nieodrzucone, więc po odmowie admina każdy z drużyny może spróbować
ponownie, bez żadnej dodatkowej akcji.

### D4. Bonusy są idempotentne przez dane, nie przez ostrożność

Zapalenie linii albo pełnej planszy daje bonus dokładnie raz. Wpis bonusowy
w księdze dostaje `ref_type = 'bingo_line'` i `ref_id` identyfikujący linię
(`wiersz-2`, `kolumna-4`, `przekatna-a`), albo `ref_type = 'bingo_plansza'`.
Funkcja przed dopisaniem sprawdza, czy taki wpis dla tej drużyny już istnieje.

**Dlaczego tak:** kolumny `ref_type` i `ref_id` są w księdze od migracji 0001
i dokładnie do tego służą. Idempotentność wychodzi wtedy z danych, a nie
z pamiętania o niej przy każdej zmianie kodu. Zero nowych tabel.

Akceptacja, punkty za zadanie, sprawdzenie linii i bonusy dzieją się
w **jednej funkcji `SECURITY DEFINER`, w jednej transakcji**. Inaczej dwóch
adminów klikających równocześnie mogłoby przyznać ten sam bonus dwa razy.

### D5. Zdjęcia z bingo widzą wszyscy zaakceptowani

Bucket `bingo` jest prywatny, jak `proofs`, ale ma **inną politykę odczytu**:
dowody przelewu widzi wyłącznie admin, bo to dane finansowe; zdjęcia z bingo
widzi każdy zaakceptowany, bo na tym polega feed.

Dostęp idzie przez podpisane URL-e generowane przy renderze.

## 4. Model danych

```sql
bingo_tasks        id, position 0..24, title, description, points, active
                   -- wspólne dla wszystkich drużyn; stan planszy jest per drużyna

bingo_submissions  id, team_id, user_id, task_id, photo_path, caption,
                   status ('pending'|'approved'|'rejected'),
                   reviewed_by, reviewed_at, review_note, created_at
                   → UNIQUE (team_id, task_id) WHERE status <> 'rejected'

feed_likes         submission_id, user_id, created_at
                   → UNIQUE (submission_id, user_id)   -- jeden lajk na osobę

feed_comments      id, submission_id, user_id, body, created_at
                   → body CHECK (length between 1 and 500)
```

**RLS:**

- `bingo_tasks` — czyta każdy zaakceptowany, pisze admin
- `bingo_submissions` — czyta każdy zaakceptowany (feed jest globalny), wstawia
  uczestnik we własnym imieniu i dla własnej drużyny, kasuje autor wyłącznie
  przy `status = 'pending'`, status zmienia wyłącznie funkcja
- `feed_likes` — czyta każdy zaakceptowany, wstawia i kasuje wyłącznie swoje
- `feed_comments` — czyta każdy zaakceptowany, wstawia swoje, kasuje autor
  **albo** admin

Komentarze są **podpisane imieniem**. To nie jest przeoczenie, tylko decyzja:
anonimowość przy sześćdziesięciu pięciu znających się osobach byłaby fikcją,
a podpis jest najskuteczniejszą moderacją, jaka istnieje.

## 5. Punktacja

Wartości startowe, **do podmiany przed wyjazdem bez wdrażania kodu**:

| Co | Ile | Gdzie |
|---|---|---|
| Zadanie | 20 | `bingo_tasks.points` — osobno dla każdego zadania |
| Linia (wiersz, kolumna, przekątna) | 50 | `app_settings.bingo_bonus_linia` |
| Pełna plansza | 200 | `app_settings.bingo_bonus_plansza` |

Linii jest dwanaście: pięć wierszy, pięć kolumn, dwie przekątne. Drużyna, która
zapali całą planszę, zbierze więc 25×20 za zadania, 12×50 za linie i 200 za
planszę — razem 1300. To jest liczba, którą warto zobaczyć przed wyjazdem
i zdecydować, czy bingo ma dominować ranking, czy być jednym z kilku źródeł.

Punkty za zadanie lecą na `user_id` autora zdjęcia. Bonusy za linie i planszę
idą jako wpis drużynowy (`user_id = NULL`, `team_id` wypełnione).

Spec główny opisuje wpis drużynowy przy okazji wydatków w sklepiku, ale mechanizm
jest ten sam i pasuje tu dokładnie: bonus za linię jest zasługą zbiorową, więc ma
podnosić saldo drużyny, nie czyjeś saldo indywidualne. **Konsekwencja, o której
trzeba pamiętać:** bonusy nie pojawią się w rankingu indywidualnym nikogo, tylko
w drużynowym. To jest zamierzone — inaczej ostatnia osoba domykająca linię
dostawałaby nagrodę za pracę czterech innych.

## 6. Dwadzieścia pięć zadań — szkielet do podmiany

Placeholdery zasiewane migracją. **Dobre bingo stoi na waszych wewnętrznych
żartach, nazwiskach i tym, co faktycznie wydarzy się na wyjeździe** — tego nie
da się napisać z góry. Poniższe są utrzymane w rejestrze sekty i nadają się na
punkt wyjścia, ale przed wyjazdem trzeba je przejrzeć i podmienić.

| # | Tytuł | Dowód |
|---|---|---|
| 0 | Zgromadzenie | Cała drużyna w jednym kadrze, przy wejściu do ośrodka |
| 1 | Ofiara ze snu | Wschód słońca widziany bez uprzedniego snu |
| 2 | Namaszczenie woźnicy | Zdjęcie z kierowcą autokaru |
| 3 | Sen niewłaściwy | Ktoś śpi w miejscu do tego nieprzeznaczonym |
| 4 | Formacja | Drużyna ustawiona w dowolną figurę geometryczną |
| 5 | Uczta | Ktoś przygotowuje posiłek dla całej drużyny |
| 6 | Zdrada | Zdjęcie z osobą z obcej drużyny, która na to przystała |
| 7 | Relikwia | Najbrzydszy przedmiot znaleziony w pokoju |
| 8 | Triumf | Dowód wygranej w dowolnej grze |
| 9 | Nieuwaga | Cała drużyna w kadrze, nikt nie patrzy w obiektyw |
| 10 | Uczony | Ktoś czyta książkę w trakcie imprezy |
| 11 | Zwierzę | Zdjęcie z dowolnym miejscowym stworzeniem |
| 12 | Odtworzenie | Drużyna odgrywa scenę z filmu |
| 13 | Pokuta | Ktoś biegnie o świcie |
| 14 | Połączenie zakazane | Najdziwniejsze zestawienie jedzenia na jednym talerzu |
| 15 | Porządek | Dowód sprzątniętego pokoju, datowany |
| 16 | Pieśń | Ktoś śpiewa przy akompaniamencie czegokolwiek |
| 17 | Audiencja | Wspólne zdjęcie z organizatorem wyjazdu |
| 18 | Objawienie | Widok, który warto zapamiętać |
| 19 | Nauka bezużyteczna | Ktoś uczy kogoś czegoś zupełnie zbędnego |
| 20 | Komplet przed północą | Cała drużyna w jednym miejscu przed 24:00 |
| 21 | Przełamanie | Dowód, że ktoś zjadł coś, czego się bał |
| 22 | Toast | Najlepszy toast wieczoru, uwieczniony |
| 23 | Zaśnięcie w pół zdania | Dokładnie to, co w tytule |
| 24 | Ostatni kadr | Ostatnie zdjęcie wyjazdu |

## 7. Przepływy

**Wrzucenie dowodu:** uczestnik wybiera pole z planszy swojej drużyny → robi
zdjęcie → kompresja po stronie klienta (ten sam moduł co przy dowodzie przelewu)
→ upload do bucketu `bingo` → wiersz w `bingo_submissions` ze statusem `pending`
→ pole na planszy pokazuje się jako oczekujące dla całej drużyny.

**Akceptacja:** admin widzi kolejkę ze zdjęciem i nazwą zadania → przyjmuje albo
odrzuca z notatką → przy przyjęciu jedna funkcja w jednej transakcji: zapala
pole, dopisuje punkty autorowi, sprawdza wszystkie dwanaście linii, dopisuje
bonusy, których jeszcze nie było, sprawdza pełną planszę.

**Feed:** zaakceptowane zgłoszenia **wszystkich drużyn**, najnowsze u góry, ze
zdjęciem, autorem, drużyną, nazwą zadania i liczbą punktów. Pod każdym lajk
i komentarze.

Ekran planszy pokazuje wyłącznie **własną drużynę** — nie ma podglądu cudzych
plansz. Postęp rywali i tak przecieka przez feed i ranking, a osobny ekran do
śledzenia obcych plansz byłby kolejną rzeczą do zbudowania bez wyraźnego zysku.

**Wycofanie:** autor może usunąć własne zgłoszenie, póki czeka — odblokowuje to
pole dla reszty drużyny.

## 8. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Kolejka zamarza, bo jeden admin nie nadąża | Wielu adminów (D2), zero nowego kodu |
| Kiepski wrzut blokuje drużynie pole | Autor wycofuje własne zgłoszenie (D3) |
| Podwójny bonus przy dwóch adminach naraz | Jedna transakcja plus idempotentność przez `ref_type`/`ref_id` (D4) |
| Nabijanie punktów lajkami | Warstwa społeczna poza ekonomią (D1) |
| Komentarz, którego ktoś rano żałuje | Podpis imieniem, kasowanie przez autora albo admina |
| Zdjęcia zjadają darmowy Storage | Kompresja po stronie klienta, ten sam moduł co w rejestracji |
| Bingo dominuje ranking | Punktacja w `app_settings`, strojona bez wdrożenia (§5) |
| Placeholderowe zadania zostają na wyjazd | Wpisane wprost w kryteria ukończenia |

## 9. Kryteria ukończenia

1. Uczestnik widzi planszę swojej drużyny ze stanem pól: puste, oczekujące,
   zapalone.
2. Wrzucenie zdjęcia tworzy zgłoszenie i blokuje pole dla reszty drużyny.
3. Autor może wycofać własne oczekujące zgłoszenie; cudzego nie.
4. Akceptacja zapala pole **całej drużynie** i dopisuje punkty autorowi.
5. Zapalenie linii dopisuje bonus dokładnie raz, także gdy dwóch adminów
   akceptuje równocześnie.
6. Zaakceptowane zdjęcie pojawia się w globalnym feedzie.
7. Lajk można postawić i cofnąć, drugi raz tej samej osobie się nie da.
8. Komentarz może usunąć jego autor albo dowolny admin; nikt inny.
9. Punkty z bingo widać w rankingu na żywo, bez odświeżania.
10. Zadania i punktacja są podmienione na prawdziwe przed wyjazdem.
