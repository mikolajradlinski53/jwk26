# Zapisy — spec projektowy

Data: 2026-09-27
Status: zatwierdzony do implementacji
Poprzedza: plan 08

## 1. Czym to jest

Przebudowa formularza rejestracyjnego pod realia Samorządu: trzy tury zapisów
(Działacze → Świeżaki → Alumni) otwierane przez admina, sztywne limity miejsc
na turę, lista rezerwowa po zapełnieniu tury i nowy zestaw pytań z klauzulami
zgodnymi z RODO.

Zastępuje formularz z planu 02 (`FormularzRejestracji.tsx`). Zostaje wszystko,
co stoi za nim: bramka domenowa `@samorzad.ue.wroc.pl`, OTP i Google, kolejka
akceptacji admina, prywatny bucket `proofs`, OCR w przeglądarce jako
podpowiedź (D4 speca głównego).

## 2. Zakres

**W zakresie:**

- tabela `pule` z przełącznikiem otwarcia i limitem dla każdej z trzech tur
- zapis przez jedną funkcję `zloz_zgloszenie()`, odporny na równoczesne kliknięcia
- lista rezerwowa bez przelewu, awans ręczny przez admina
- formularz krokowy: pula → zasady → dane → ICE → zdrowie → o tobie → przelew
- walidacja pełnoletności na dzień wyjazdu, w przeglądarce i w bazie
- klauzula informacyjna RODO, regulamin, oświadczenie o odpowiedzialności
  za szkody, zbiorcza zgoda na wizerunek
- dane zdrowotne i ICE w osobnej tabeli, kasowane automatycznie po wyjeździe
- wycofanie zgody na dane zdrowotne i na wizerunek z poziomu apki
- zakładka „Zapisy" w panelu admina
- blokada otwarcia tur, dopóki regulamin ma status roboczy

**Poza zakresem, świadomie:**

- **Arkusz Google przez GAS** — osobny spec, po tym. Arkusz jest podglądem
  bazy, więc nie ma czego do niego wysyłać, zanim baza nie ma nowych pól.
  Robocze założenie dla tamtego speca: `dane_wrazliwe` do arkusza nie trafia.
- **Funkcja pokoi w apce** — lista zakwaterowania, na którą powołuje się
  oświadczenie o szkodach, prowadzi organizator poza apką.
- **Automatyczny awans z rezerwy** i **automatyczne przesuwanie wolnych miejsc
  między pulami** — admin robi jedno i drugie ręcznie (D3, D4).
- **Otwarcie logowania dla adresów spoza `@samorzad`** — wszystkie trzy grupy
  uczestników mają konta samorządowe.
- **Warstwa wizualna** — ekrany w surowej konwencji reszty `/app`.

## 3. Decyzje

### D1. Pulę wybiera uczestnik, weryfikuje admin

Pierwszy krok formularza to wybór jednej z otwartych pul. Domena maila nie
odróżnia Działacza od Świeżaka, a lista osób na pulę wymagałaby przygotowania,
którego nikt nie zrobi przed 12 października.

Koszt: ktoś, kto wybierze złą pulę, zajmuje miejsce do czasu, aż admin go
odrzuci. Admin widzi pulę przy każdym zgłoszeniu i odrzuca z notatką.

### D2. Zapis i przelew w jednym podejściu

Formularz kończy się zdjęciem przelewu, tak jak dziś. Wpłaty są przyjmowane
12–20 października 2026, więc **wszystkie tury muszą zmieścić się w tym oknie**.
Apka tego nie wymusza — to kwestia tego, kiedy admin otworzy tury.

### D3. Rezerwa bez przelewu, awans ręczny

Gdy pula jest pełna, formularz pomija krok przelewu i zapisuje osobę na rezerwę
z numerem w kolejce. Nikt nie płaci za miejsce, którego może nie dostać,
więc nie ma zwrotów.

Zwolnione miejsce (odrzucenie) nie awansuje nikogo samo. Admin klika „awansuj",
osoba widzi w apce ekran do wgrania przelewu, a po wgraniu jej zgłoszenie
wchodzi do zwykłej kolejki akceptacji.

**Wyjątek:** jeśli pula zapełniła się, gdy ktoś był w trakcie formularza, jego
zdjęcie przelewu jest już w buckecie. Funkcja odbija zapis na miejsce,
formularz proponuje rezerwę, a ścieżka do zdjęcia zostaje przy zgłoszeniu
rezerwowym. Przy awansie takie zgłoszenie idzie od razu do akceptacji, bez
ponownego uploadu.

### D4. Limity per pula, zmieniane ręcznie

Każda pula ma własny `limit`, edytowalny w każdej chwili. Niewykorzystane
miejsca jednej tury admin przesuwa do innej, zmieniając dwie liczby.

Miejsce zajmują zgłoszenia `pending` i `approved`, które nie są rezerwowe.
Obniżenie limitu poniżej liczby zajętych miejsc jest dozwolone — nikt nie
wylatuje, po prostu nikt nowy nie wchodzi.

### D5. Zapis wyłącznie przez funkcję z blokadą

`zloz_zgloszenie()` to `SECURITY DEFINER`, który w jednej transakcji blokuje
wiersz puli (`for update`), liczy zajęte miejsca i zapisuje. Polityka INSERT
na `registrations` znika.

**Dlaczego nie trigger:** przy otwarciu tury kilkadziesiąt osób klika w tej
samej minucie. Trigger bez blokady przepuści 41. osobę na 40 miejsc; trigger
z blokadą to ta sama funkcja, tylko trudniejsza do przetestowania i do
przeczytania. Ten sam idiom broni salda w `zakrec_slotami` i stanu magazynu
w sklepiku.

### D6. Dane zdrowotne i ICE w osobnej tabeli

`dane_wrazliwe` żyje obok `registrations`, jeden wiersz na zgłoszenie, i tylko
wtedy, gdy uczestnik coś w nią wpisał.

**Dlaczego:** dane z art. 9 RODO mają inną podstawę (wyraźna zgoda), inny
termin (14 dni po wyjeździe) i inne prawo do wycofania niż reszta zgłoszenia.
Osobna tabela pozwala je skasować jednym `delete` bez ruszania oświadczenia
o szkodach, które musi przetrwać dłużej. Pozwala też nie wysłać ich przypadkiem
do arkusza, do realtime ani do żadnego `select *`.

### D7. Pełnoletność na dzień wyjazdu, liczona z `data_jwk`

Próg to `data_jwk::date - interval '18 years'`, czyli przy obecnym ustawieniu
**urodzeni najpóźniej 23.10.2008**. Osoba urodzona 23.10.2008 kończy 18 lat
w dniu wyjazdu i przechodzi.

Liczone z `app_settings.data_jwk`, a nie wpisane na sztywno: ta data już steruje
odliczaniem na landingu, a dwie kopie tej samej daty to dwie prawdy.

### D8. Zgody wersjonowane w kodzie, regulamin musi być zatwierdzony

Teksty klauzuli, oświadczenia i zgody na wizerunek żyją w jednym pliku
`src/lib/zapisy/zgody.ts` razem ze stałą `WERSJA_ZGOD`. Zgłoszenie zapisuje wersję,
którą uczestnik zobaczył. Zmiana treści bez podbicia wersji jest błędem
przeglądu kodu, nie czymś, co wyłapie baza.

`app_settings.regulamin_zatwierdzony` (domyślnie `false`) steruje banerem
„Wersja robocza" na `/regulamin` i blokuje otwarcie jakiejkolwiek puli:
`ustaw_pule()` odmawia `otwarta = true`, dopóki regulamin jest roboczy.
Akceptacja wersji roboczej niczego nie wiąże, więc zapis, który by na niej
stał, byłby zapisem bez regulaminu.

### D9. Zgoda na wizerunek jest jedna, zbiorcza i dobrowolna

Jeden checkbox obejmuje cztery kanały. Nie blokuje zapisu — zgoda, bez której
nie da się pojechać, nie jest dobrowolna (art. 7 ust. 4 RODO) i nie dałaby
organizatorowi podstawy do publikacji.

Konsekwencja poza apką: osoby bez zgody są oznaczone w panelu i na liście
identyfikatorów. Zdjęcia bingo w feedzie mogą je pokazywać, bo feed jest
zamknięty w apce, ale przed publikacją czegokolwiek na zewnątrz ktoś musi
to sprawdzić ręcznie.

Punkt 5 regulaminu („kto nie chce się znaleźć na zdjęciach, zgłasza to")
jest opt-outem i zostaje przepisany na odesłanie do zgody z formularza.

### D10. Retencja w dwóch terminach, przez `pg_cron`

- `dane_wrazliwe` — kasowane **14 dni po `data_konca_jwk`** (nowe ustawienie,
  `2026-10-25`), czyli 8 listopada 2026.
- dane identyfikacyjne i akceptacje w `registrations` — **31 grudnia 2027**,
  żeby dało się rozliczyć szkody z ośrodkiem w typowym horyzoncie reklamacji.

Codzienne zadanie `pg_cron` woła funkcję `sprzataj_dane()`. Funkcja jest
osobna od harmonogramu, żeby test mógł ją wywołać wprost. Jeśli rozszerzenie
okaże się niedostępne w projekcie, plan wraca do tej decyzji — nie zastępuje
jej po cichu przyciskiem, którego nikt nie kliknie.

### D11. Ksywka z identyfikatora zostaje nazwą w apce

Po akceptacji `review_registration` ustawia `profiles.display_name` na
`ksywka`, a nie na imię i nazwisko. Ranking i feed pokazują to, co ludzie
sami chcą nosić na piersi. Imię i nazwisko zostają w `registrations` dla
admina. Decyzja do łatwego odwrócenia, jeśli zarząd woli nazwiska.

### D12. Istniejące zgłoszenie przeżywa migrację

Na produkcji jest jedno zgłoszenie (`approved`). Nowe kolumny dopuszczają
`NULL` na poziomie tabeli, a wymagalność pilnuje `zloz_zgloszenie()`.
`full_name` i `diet_notes` zostają jako kolumny historyczne, nieużywane przez
nowy kod. Kasowanie ich to osobna decyzja po wyjeździe.

## 4. Formularz

Jeden ekran na krok, pasek postępu, cofanie bez utraty wpisanych danych.
Stan formularza żyje w komponencie klienckim; nic nie idzie do bazy przed
ostatnim krokiem.

| # | Krok | Pola | Wymagane |
|---|---|---|---|
| 1 | Pula | wybór z otwartych; kafel zamkniętej wyszarzony, kafel pełnej mówi „zapis na rezerwę (N w kolejce)" | tak |
| 2 | Zasady | klauzula informacyjna („Zapoznałem się"), regulamin („Akceptuję", link), oświadczenie o szkodach („Akceptuję"), zgoda na wizerunek | trzy pierwsze tak, wizerunek nie |
| 3 | Dane | imię, nazwisko, numer indeksu, data urodzenia, telefon, zgoda na SMS-y | wszystko poza SMS; indeks opcjonalny w puli Alumni |
| 4 | ICE | imię osoby, jej telefon, „Ta osoba wie, że podaję jej numer, i zgadza się na kontakt w nagłym wypadku" | nie; jeśli telefon wpisany, potwierdzenie obowiązkowe |
| 5 | Zdrowie | dieta, alergie, choroby przewlekłe i przyjmowane leki, zgoda z art. 9 | nie; jeśli cokolwiek wpisane, zgoda obowiązkowa |
| 6 | O tobie | dojazd, ksywka na identyfikator, zwolnienie rektorskie (poza Alumni), alkohol, piosenka, uwagi | dojazd i ksywka tak |
| 7 | Przelew | zdjęcie, OCR | tak, poza rezerwą |

**Brzmienie pytań z kroku 6:**

- „Jaki planujesz dojazd?"
  - Jadę autokarem w obie strony
  - Jadę autokarem tylko na wyjazd
  - Jadę autokarem tylko na powrót
  - Dojeżdżam samodzielnie w obie strony
- „Jak mamy cię podpisać na identyfikatorze?" (do 24 znaków)
- „Jaki utwór rozpęta rytuał na parkiecie?"
- „Chcesz coś dodać od siebie?"

**Dopisane 2026-09-28** (wersja zgód `2026-09-28`):

- „Potrzebuję zwolnienia rektorskiego na I dzień wyjazdu, tj. 23.10.2026" —
  dobrowolne, niewidoczne dla Alumnów. Po zaznaczeniu: godziny od–do co 30 minut
  w przedziale 12:00–18:00 (wyjazd rusza o 12:00), koniec po początku.
- „Czy pijasz alkohol?" — dobrowolne: „Nie, jestem abstynentem" / „Czasami :)" /
  „TAK, i to chętnie ;)" / „Wolę nie odpowiadać". Brzmienie trzeciej odpowiedzi
  złagodzone z „jestem alkoholikiem", żeby odpowiedź nie była deklaracją choroby
  (art. 9 RODO) — dzięki temu pole żyje w `registrations`, nie w `dane_wrazliwe`.
- Oba pola dopisane do klauzuli informacyjnej (art. 6 ust. 1 lit. b, dobrowolne).
- Krok ICE: pole „Kim jest dla Ciebie?" (mama, partner…), obowiązkowe razem
  z resztą ICE, do 40 znaków, w `dane_wrazliwe.ice_relacja`.
- Krok „Przelew" i dopłata po awansie: karta „Dane do przelewu" — kwota, odbiorca,
  numer konta i tytuł `JWK26 Imię Nazwisko` z przyciskami „Kopiuj" oraz kod QR
  w formacie ZBP (aplikacja banku wypełnia przelew sama). Dane w `app_settings`
  (`przelew_numer_konta`, `przelew_odbiorca`, `przelew_kwota`), ustawiane
  w `/app/admin/ustawienia`; ta sama karta zastępuje zaślepkę na landingu.
  Bez numeru konta karta mówi „dane pojawią się wkrótce".

**Walidacja w przeglądarce** powtarza walidację funkcji, żeby błąd pojawiał
się przy polu, a nie po wysłaniu. Źródłem prawdy jest funkcja.

**Komunikat przy niepełnoletności:** „Na JWK26 jadą osoby, które 23 października
2026 mają skończone 18 lat." Zdanie, nie kod błędu, i bez sugestii, że da się
to obejść.

## 5. Teksty prawne

Teksty poniżej to pierwsza wersja z 27.09; obowiązująca treść żyje
w `src/lib/zapisy/zgody.ts`. Autor tych tekstów nie jest prawnikiem.

### Klauzula informacyjna (art. 13 RODO) — elementy obowiązkowe

- Administrator: Uniwersytet Ekonomiczny we Wrocławiu, ul. Komandorska 118/120,
  53-345 Wrocław.
- Kontakt z Inspektorem Ochrony Danych: `iod@ue.wroc.pl`. Stała w `zgody.ts`;
  test jednostkowy pilnuje, żeby nie była pusta.
- Cele i podstawy:
  - organizacja wyjazdu i weryfikacja warunku pełnoletności (imię, nazwisko,
    indeks, data urodzenia, telefon, dojazd, ksywka) — art. 6 ust. 1 lit. b,
    udział na wniosek uczestnika
  - dochodzenie roszczeń z tytułu szkód — art. 6 ust. 1 lit. f
  - kontakt w nagłym wypadku (dane osoby ICE) — art. 6 ust. 1 lit. f
  - dieta, alergie, choroby i leki — art. 9 ust. 2 lit. a, wyraźna zgoda
  - wizerunek — art. 6 ust. 1 lit. a, zgoda, oraz art. 81 prawa autorskiego
  - SMS-y organizacyjne — zgoda
- Odbiorcy: organizatorzy wyjazdu; ośrodek wyłącznie w zakresie diety
  i alergii; dostawcy infrastruktury (Supabase, Vercel) jako podmioty
  przetwarzające.
- Okres przechowywania: jak w D10.
- Prawa: dostęp, sprostowanie, usunięcie, ograniczenie, sprzeciw, wycofanie
  zgody w dowolnym momencie bez wpływu na wcześniejsze przetwarzanie, skarga
  do Prezesa UODO.
- Podanie danych z kroków 3 i 6 jest warunkiem udziału; z kroków 4 i 5
  oraz zgoda na wizerunek — dobrowolne.

### Obowiązek wobec osoby ICE (art. 14 RODO)

Organizator nie ma jak poinformować osoby ICE sam. Checkbox w kroku 4 jest
oświadczeniem uczestnika, że to zrobił. Tekst krótkiej informacji dla osoby
ICE (kto, po co, na jak długo) jest widoczny pod checkboxem, żeby uczestnik
miał co przekazać.

### Klauzula przy danych zdrowotnych (krok 5)

> Te informacje są dobrowolne. Służą wyłącznie przygotowaniu odpowiednich
> posiłków i udzieleniu pomocy w sytuacji wyjątkowej. Widzą je tylko
> organizatorzy, a ośrodek — wyłącznie dietę i alergie. Kasujemy je
> 14 dni po wyjeździe. Zgodę możesz wycofać w apce w każdej chwili.
>
> ☐ Wyrażam wyraźną zgodę na przetwarzanie podanych wyżej danych o moim
> zdrowiu w celach opisanych powyżej.

### Oświadczenie o odpowiedzialności za szkody

> Oświadczam, że odpowiadam za szkody w mieniu ośrodka wyrządzone przeze mnie
> w czasie wyjazdu. Jeżeli szkoda powstanie w pokoju, w którym jestem
> zakwaterowany według listy zakwaterowania prowadzonej przez organizatora,
> a osoby, która ją wyrządziła, nie da się ustalić albo nikt nie przyzna się
> do jej wyrządzenia, odpowiadam za nią solidarnie z pozostałymi osobami
> zakwaterowanymi w tym pokoju. Organizator — Uniwersytet Ekonomiczny we
> Wrocławiu, reprezentowany przez koordynatora wyjazdu — może żądać pokrycia
> szkody, a w razie odmowy dochodzić jej na drodze postępowania cywilnego.

**Dwa zastrzeżenia do przeglądu prawnego:**

1. Wierzycielem jest organizator, nie koordynator jako osoba prywatna —
   koordynator nie może pozwać za szkodę, która nie jest jego.
2. Solidarna odpowiedzialność za cudzą szkodę w umowie z konsumentem może
   zostać uznana za postanowienie niedozwolone (art. 385¹ KC). Tekst jest
   zawężony do pokoju i do sytuacji, w której sprawcy nie da się ustalić,
   ale ostatnie słowo należy do prawnika.

To samo oświadczenie trafia do regulaminu jako nowy punkt, żeby akceptacja
regulaminu i oświadczenia mówiły to samo.

### Zgoda na wizerunek

> ☐ Zgadzam się na nieodpłatne rozpowszechnianie mojego wizerunku utrwalonego
> podczas JWK26 na stronie internetowej, w materiałach promocyjnych,
> w materiałach dotyczących współprac partnerskich oraz w serwisie JWK26.
> Zgoda jest dobrowolna i mogę ją w każdej chwili wycofać.

## 6. Model danych

```sql
pule              klucz ('dzialacze'|'swiezaki'|'alumni') pk, nazwa,
                  otwarta boolean, limit integer, kolejnosc smallint
                  -- zapis tylko przez ustaw_pule() (admin)

registrations     + pula, imie, nazwisko, nr_indeksu, data_urodzenia,
                    dojazd ('autokar_oba'|'autokar_tam'|'autokar_powrot'|'wlasny'),
                    ksywka, piosenka, uwagi,
                    wersja_zgod, zgoda_wizerunek boolean,
                    zgoda_wizerunek_wycofana_at,
                    rezerwa boolean default false, kolejnosc_rezerwy integer
                  ~ proof_path nullable (rezerwa bez zdjęcia)
                  - polityka INSERT usunięta (D5)

dane_wrazliwe     registration_id pk → registrations on delete cascade,
                  ice_imie, ice_telefon, ice_poinformowany boolean,
                  dieta, alergie, choroby_leki,
                  zgoda_art9_at timestamptz
                  -- SELECT: właściciel zgłoszenia i admin; zapis tylko przez funkcje
                  -- nie w publikacji supabase_realtime

app_settings      + regulamin_zatwierdzony (false), data_konca_jwk ("2026-10-25")
```

Tabela nie ma ograniczenia wiążącego `rezerwa` z `proof_path`: rezerwa bywa
ze zdjęciem (wyjątek z D3) i bez, a zgłoszenie na miejsce po awansie przez
chwilę nie ma zdjęcia. Jedyna reguła, która się liczy — „akceptacja wymaga
zdjęcia i nie-rezerwy" — żyje w `review_registration`.

### Funkcje

| Funkcja | Kto | Co robi |
|---|---|---|
| `zloz_zgloszenie(p_dane jsonb, p_wrazliwe jsonb, p_proof_path, p_ocr..., p_na_rezerwe boolean)` | uczestnik bez zaakceptowanego zgłoszenia | waliduje, blokuje pulę, zapisuje na miejsce albo rezerwę; przy pełnej puli i `p_na_rezerwe = false` rzuca `PULA_PELNA` |
| `ustaw_pule(p_klucz, p_otwarta, p_limit)` | admin | zmienia pulę; odmawia otwarcia przy roboczym regulaminie |
| `awansuj_z_rezerwy(p_registration_id)` | admin | `rezerwa = false`; odmawia, gdy pula nie ma wolnego miejsca |
| `dolacz_przelew(p_proof_path, p_ocr...)` | właściciel awansowanego zgłoszenia bez zdjęcia | dopisuje zdjęcie i OCR |
| `wycofaj_zgode_zdrowie()` | właściciel | kasuje swój wiersz `dane_wrazliwe` |
| `wycofaj_zgode_wizerunek()` | właściciel | `zgoda_wizerunek = false`, stempel czasu |
| `sprzataj_dane()` | `pg_cron` | retencja z D10 |
| `review_registration(...)` (zmiana) | admin | odmawia akceptacji rezerwy i zgłoszenia bez zdjęcia; `display_name = ksywka` (D11) |

Ścieżka zdjęcia w `zloz_zgloszenie` i `dolacz_przelew` przechodzi te same
sprawdzenia, co dziś polityka INSERT: własny folder, bez `..`.

Unikalny indeks `registrations_one_pending_idx` zostaje: rezerwa ma status
`pending`, więc osoba nie zapisze się jednocześnie na miejsce i na rezerwę
ani do dwóch pul.

## 7. Ekrany

- `/app/rejestracja` — formularz krokowy zamiast obecnego; poczekalnia
  rozróżnia „czekasz na akceptację", „jesteś na rezerwie, numer N" i
  „awansowałeś — wgraj przelew" (ten ostatni z formularzem jednego pola).
- `/app/wiecej` — sekcja „Twoje zgody": usunięcie danych zdrowotnych,
  wycofanie zgody na wizerunek. Obie akcje z potwierdzeniem.
- `/app/admin/zapisy` (nowa) — trzy pule z przełącznikiem i limitem, licznik
  „zajęte / limit / rezerwa", kolejka rezerwy z przyciskiem „awansuj",
  przełącznik zatwierdzenia regulaminu.
- `/app/admin/rejestracje` (zmiana) — pula i znacznik „bez zgody na wizerunek"
  przy każdym zgłoszeniu; dane z `dane_wrazliwe` pod rozwijanym przyciskiem.
- `/regulamin` — baner zależny od `regulamin_zatwierdzony`; punkt o szkodach;
  punkt 5 przepisany (D9).

## 8. Testy

Vitest przeciwko `jwk26-test`, nowy plik `tests/db/zapisy.test.ts`,
logowanie raz w `beforeAll`.

- zamknięta pula odbija zapis
- pełna pula: bez `p_na_rezerwe` rzuca `PULA_PELNA`, z nim zapisuje rezerwę
  z kolejnym numerem
- **dwa równoczesne zapisy na ostatnie miejsce: jeden na miejsce, drugi odbity**
- wiek: urodzony 23.10.2008 przechodzi, 24.10.2008 nie
- telefon ICE bez potwierdzenia odbija zapis
- dane zdrowotne bez zgody odbijają zapis
- brak którejś z trzech obowiązkowych akceptacji odbija zapis
- obcy uczestnik nie czyta cudzego `dane_wrazliwe`, anonim nie czyta nic
- bezpośredni INSERT do `registrations` odbity
- `ustaw_pule` odmawia otwarcia przy roboczym regulaminie i odmawia nie-adminowi
- awans: przy braku miejsca odmowa; po awansie `dolacz_przelew` działa
  tylko właścicielowi
- `review_registration` odmawia akceptacji rezerwy i zgłoszenia bez zdjęcia
- `wycofaj_zgode_zdrowie` kasuje wiersz
- `sprzataj_dane` przy `data_konca_jwk` przesuniętej w przeszłość kasuje
  `dane_wrazliwe` i nie rusza `registrations`; przy dacie po 31.12.2027
  czyści też dane identyfikacyjne

Istniejące testy rejestracji z planu 02 wstawiają zgłoszenia bezpośrednim
INSERT-em. Po D5 przechodzą na `zloz_zgloszenie()` albo na klucz serwisowy
— to część planu, nie niespodzianka.

## 9. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Teksty prawne nieprzejrzane do 12.10 | D8: tury nie otworzą się przy roboczym regulaminie |
| Tłok przy otwarciu tury przebija limit | D5, test równoczesności |
| Dane zdrowotne wyciekają do arkusza lub realtime | D6, osobny spec GAS zaczyna od listy dozwolonych kolumn |
| Retencja nigdy się nie wykonuje | D10, `pg_cron` + test funkcji; sprawdzenie w planie, że zadanie jest zarejestrowane na produkcji |
| Uczestnik wybiera złą pulę | D1, pula widoczna w kolejce admina |
| Formularz długi na telefonie, porzucany w połowie | kroki z zachowanym stanem; to jest świadomy koszt kompletu zgód |
