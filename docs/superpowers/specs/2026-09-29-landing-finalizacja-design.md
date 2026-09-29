# Landing — finalizacja: zasłony, treści, żaba-przewodnik

**Data:** 2026-09-29
**Stan:** zatwierdzony w rozmowie, czeka na przegląd spisanej wersji
**Plany:** 16a (zasłony i treści), 16b (żaba)

## Po co to jest

Landing stoi od planu „Preludium” (spec 2026-09-17), ale:

- **treści się rozjechały** z regulaminem i aplikacją — kontakt na
  `samorzad@…` zamiast koordynatora, wymijające FAQ („zasady ustala
  organizator”), brak tur zapisów, brak polityki prywatności;
- **są puste miejsca** — wielka ramka „film wkrótce”, mapa jako pusty
  prostokąt, osierocone zdjęcie w galerii;
- **jest błąd** — ikony Instagrama i Facebooka prowadzą na strony główne
  serwisów;
- **nie ma napięcia** — wszystko widać od razu, nie ma powodu wracać.

Finalizacja zostawia układ i jesienny styl, porządkuje treści pod zapisy,
**zakrywa trzy sekcje do wyznaczonych dat** i dokłada **żabę, która chodzi
po stronie w rytm przewijania**.

## Zasada nadrzędna, bez zmian

Landing jest przykrywką: **motyw sekty nie może wyciec** — ani w treści,
ani w metadanych, podglądzie linku, opisach alternatywnych, czy tekstach
wybranych z harmonogramu. Każda nowa rzecz w tym specu przechodzi przez ten
filtr.

## Decyzje

| Decyzja | Powód |
|---|---|
| układ i styl zostają, zmienia się kolejność i treść (wariant B) | strona ma prowadzić od „co to” do „jak się zapisać”, nie wymaga nowego wyglądu |
| trzy zasłony z osobnymi datami: ośrodek, cena, zapisy | każda odsłona to powód, żeby wrócić |
| odsłona zapisów odsłania wszystko | nikt nie akceptuje regulaminu z ukrytym miejscem ani nie płaci bez widocznej ceny |
| zakryta treść nie wychodzi z bazy przed czasem | zasłona wyłącznie w HTML-u byłaby dekoracją — klucze są dziś publiczne przez API |
| zasłona „ośrodek” ukrywa też miasto | mocniejsza tajemnica — decyzja właściciela |
| tury opisane na stałe, bez stanu na żywo i bez dat | decyzja właściciela; otwarcie tur ogłasza Instagram |
| bez liczby miejsc na landingu | decyzja właściciela |
| plan z harmonogramu, punkty oznaczone „na landing” | plan żyje w jednym miejscu; publiczne jest tylko to, co admin wskaże |
| FAQ w kodzie | poprawki przez rozmowę, bez panelu |
| adresy Instagrama i Facebooka w Ustawieniach | wklejenie adresu bez wdrożenia; pusty = ikona ukryta |
| żaba chodzi, wskazuje i się wygłupia — nie mówi | charakter bez tekstów do pilnowania pod kątem motywu |
| własna twarz żaby w stylu przykładów, koszulka „JWK” w rdzy | przykłady to praktycznie Pepe (prawa Matta Furie); rdza i JWK niczego nie zdradzają |

## 1. Zasłony

### Daty

Trzy nowe klucze w `app_settings`, edytowane w `/app/admin/ustawienia`
obok istniejących dat:

| Klucz | Wartość początkowa |
|---|---|
| `odslona_osrodek` | `2026-10-05T18:00:00+02:00` |
| `odslona_cena` | `2026-10-08T18:00:00+02:00` |
| `odslona_zapisy` | `2026-10-12T18:00:00+02:00` |

**Reguła porządku:** sekcja jest odsłonięta, gdy minęła jej data **albo**
data zapisów. Liczy to jedna funkcja w bazie (`odsloniete(p_co text)`), a jej
lustro w TypeScripcie (`src/lib/odslony.ts`) służy tylko do liczników —
decyzję, co wysłać, podejmuje zawsze baza.

Pusta data = sekcja odsłonięta (bezpieczny stan dla nowej bazy i testów).

### Zakryta treść nie wychodzi z bazy

Dziś `settings_read_public` daje niezalogowanemu `miejsce_nazwa`,
`miejsce_adres` i trzy klucze przelewu. Po zmianie polityka odczytu tych
kluczy — dla `anon` i dla zalogowanego nie-admina — ma dodatkowy warunek:

- `miejsce_nazwa`, `miejsce_adres` → `odsloniete('osrodek')`;
- `przelew_kwota`, `przelew_numer_konta`, `przelew_odbiorca` → `odsloniete('cena')`.

Admin czyta zawsze. Landing czyta tym samym kluczem `anon` co dziś, więc
przed odsłoną **sam dostaje pustkę** — nie ma w kodzie strony gałęzi, która
mogłaby przez pomyłkę wysłać prawdziwą wartość.

Treści zakodowane na sztywno (zdjęcia ośrodka i ich opisy, słowo „Karpacz”,
kwota w tekstach) renderuje wyłącznie serwer i wyłącznie po odsłonie
(`odsloniete()` wołane z `page.tsx`). Zdjęcia ośrodka przenoszą się pod losowe
nazwy (`public/hero/o-<losowe>.jpg`), żeby nie dało się ich zgadnąć po adresie.

### Wygląd zakrytej sekcji — rozmyta atrapa

Komponent `Zaslona`:

- nagłówek sekcji widoczny (numer, nadtytuł, tytuł);
- pod nim **atrapa** — rozmyte, statyczne kształty udające treść (bloki,
  prostokąty „zdjęć”, linie „tekstu”); atrapa nie powstaje z prawdziwej treści;
- na wierzchu licznik „Odsłonimy za 3 d 04:12:55” w stylu istniejącego
  `Licznik`, policzony na serwerze w pierwszej klatce (`poczatkowe`);
- atrapa jest `aria-hidden`, czytnik ekranu słyszy „Odsłonimy 5 października
  o 18:00” zamiast tykającego licznika.

**Moment odsłony:** licznik na zerze woła `router.refresh()`. Serwer zwraca
odsłoniętą sekcję; wejście treści to krótkie przejście z rozmycia do ostrości
(bez przejścia przy `prefers-reduced-motion`). Kto wchodzi po czasie, dostaje
od razu odsłoniętą sekcję bez animacji.

### Co zakrywa każda zasłona

| Zasłona | W sekcji | Poza sekcją |
|---|---|---|
| **ośrodek** | „Kiedy i gdzie”: daty jawne; zdjęcia, nazwa, adres, mapa — atrapa | „Karpacz” znika z: metadanych (opis, podgląd linku), linii pod licznikiem w hero („23–25 października · miejsce wkrótce”), paska faktów, stopki, „Co zabrać” („w górach w drugiej połowie października bywa zimno…”); regulamin § 1 ust. 3 — patrz niżej |
| **cena** | „Cena i wpłata”: kwota, terminy wpłat, dane do przelewu — atrapa | pasek faktów: „cena wkrótce” |
| **zapisy** | „Zapisy”: opis tur i 3 kroki **jawne**; zamiast „Zapisz się” — licznik „Zapisy ruszają za…” nad wyszarzonym przyciskiem | ten sam zamiennik w hero, w panelu wezwania (`PanelWezwania`) i w nawigacji stopki; „Wejdź” w nagłówku zostaje aktywne (konta już istniejące, admini) |

### Regulamin przed odsłoną ośrodka

`/regulamin` jest podpięty pod landing i podaje miejsce w § 1 ust. 3. Do
`odsloniete('osrodek')` ten ustęp brzmi:

> Wydarzenie odbywa się od dnia 23 października 2026 r. do dnia 25 października
> 2026 r. w ośrodku wypoczynkowym, którego nazwę i adres Organizator ogłosi
> przed rozpoczęciem zapisów, a także w innych miejscach, w których jest
> realizowany ogłoszony program.

Po odsłonie wraca pełne brzmienie. Wersja zgód się nie zmienia: ze względu na
regułę porządku każdy, kto akceptuje regulamin (dopiero po odsłonie zapisów),
widzi pełną treść. Maskowanie robi funkcja nad `REGULAMIN`, nie druga kopia
tekstu.

Polityka prywatności i klauzula nie zawierają miejsca — bez zmian.

## 2. Sekcje po kolei

| # | Sekcja | Treść |
|---|---|---|
| — | Nagłówek | bez zmian; „Wejdź” aktywne zawsze |
| — | Wejście (hero) | logo, licznik do wyjazdu, linia „23–25 października · {Karpacz \| miejsce wkrótce}”, przycisk zapisu albo zasłona zapisów; żaba macha (plan 16b) |
| 01 | Czym to jest | poprawiony opis; pasek faktów: **3 dni · {320 zł \| cena wkrótce} · {Karpacz \| miejsce wkrótce}** |
| 02 | Plan (nowa) | punkty harmonogramu z `na_landingu`, po dniach, jak ekran harmonogramu w apce, w jesiennej oprawie; brak punktów = sekcja znika |
| 03 | Kiedy i gdzie | zasłona „ośrodek”; po odsłonie zdjęcia, nazwa, adres i **kompaktowa karta mapy** (adres + „Otwórz w Mapach”, osadzona mapa po dotknięciu — bez pustego prostokąta) |
| 04 | Zapisy (przebudowana) | tury, lista rezerwowa, 3 kroki, zasłona przycisku — treść niżej |
| 05 | Cena i wpłata | zasłona „cena”; po odsłonie jak dziś (kwota, wpłaty 12–20.10, zakres ceny, dane do przelewu z QR) |
| 06 | Zapowiedź | galeria bez osieroconego zdjęcia (siatka dopasowana do liczby zdjęć); ramka filmu — patrz niżej; żaba trzyma ramkę (plan 16b) |
| 07 | Co zabrać | bez zmian poza zdaniem o miejscu |
| 08 | Pytania | nowe odpowiedzi — treść niżej; pod listą kontakt do koordynatora |
| 09 | Zasady i dokumenty | regulamin + polityka prywatności, po jednym zdaniu i odnośniku |
| — | Stopka | nawigacja po nowych kotwicach (`#plan`, `#zapisy`, `#pytania`), „Polityka prywatności” w dolnym pasku, kontakt do koordynatora zamiast `samorzad@…`, ikony z adresów w Ustawieniach |

Sekcja „08 Przyjęcie świeżaków” znika jako osobna — jej licznik trafia do
opisu tury Świeżaków.

### 04 Zapisy — treść

**Tury** (trzy karty, kolejność jak w bazie):

- **Działacze** — „Osoby działające w komisjach, jednostkach i projektach
  Samorządu. Ich tura rusza pierwsza.”
- **Świeżaki** — „Nowi członkowie Samorządu przyjęci w tegorocznej
  rekrutacji. Tura rusza po przyjęciu świeżaków.” + mały licznik
  „Do przyjęcia świeżaków” (`data_swiezakow`), po terminie „Przyjęcie za nami”.
- **Alumni** — „Byli członkowie Samorządu. Tura rusza na końcu.”

Pod kartami: „Każda tura ma ustaloną liczbę miejsc. Gdy się zapełni,
zapiszesz się na listę rezerwową bez wpłaty — jeśli ktoś zrezygnuje,
organizator przesuwa kolejną osobę z rezerwy i prosi ją o wpłatę. Otwarcie
każdej tury ogłaszamy na Instagramie.”

**Kroki** — jak dziś, z poprawkami: krok 01 „Zaloguj się kontem
@samorzad.ue.wroc.pl” (także Alumni), krok 02 bez zmian, krok 03 „Decyzję
zobaczysz po zalogowaniu w aplikacji; dostaniesz też powiadomienie, jeśli je
włączysz”.

### 08 Pytania — treść (szkic do poprawek w rozmowie)

1. **Kto może jechać?** Pełnoletnie osoby z komisji, jednostek i projektów
   Samorządu, świeżaki przyjęci w rekrutacji i Alumni — wszyscy logują się
   kontem @samorzad.ue.wroc.pl. Szczegóły w § 3 regulaminu.
2. **Co, jeśli tura jest pełna?** Lista rezerwowa bez wpłaty (jak wyżej).
3. **Co, jeśli zrezygnuję?** Napisz do koordynatora jak najszybciej; skutki
   finansowe określają warunki płatności przekazane przed wpłatą (§ 17).
4. **Jak dojeżdżamy?** Autokarem w obie strony albo własnym transportem —
   wybierasz w formularzu (autokar tam, z powrotem, w obie strony albo
   własny). Godzinę i miejsce zbiórki podamy przed wyjazdem.
5. **Co z jedzeniem i dietami?** Dietę i alergie podajesz w formularzu,
   dobrowolnie; ośrodek dostaje wyłącznie te informacje.
6. **Czy zgłoszenie może zostać odrzucone?** Jak dziś.

Kontakt pod listą: Dawid Rutkowski, `dawid.rutkowski@samorzad.ue.wroc.pl`,
608 008 363 — te same stałe co w regulaminie (`KOORDYNATOR_MAIL`,
`KOORDYNATOR_TELEFON`).

### Plan z harmonogramu

- Kolumna `harmonogram.na_landingu boolean not null default false`.
- Polityka odczytu dla `anon`: tylko wiersze z `na_landingu`, tylko kolumny
  dzień, godzina, tytuł, opis.
- Edytor w Sanktuarium: przełącznik „Pokaż na landingu” przy punkcie
  i ostrzeżenie „Publiczne — bez motywu i bez nazwy miejsca przed odsłoną”.
- **Szkic na start** (migracja, oznaczony w opisie „(szkic)”, do podmiany
  przez właściciela po konsultacji z Zespołem): piątek — wyjazd po południu,
  zakwaterowanie, kolacja, wieczór integracyjny; sobota — śniadanie,
  szkolenia w komisjach, obiad, gra terenowa w drużynach, kolacja, impreza;
  niedziela — śniadanie, podsumowanie, wykwaterowanie, powrót. Bez słów
  z motywu.

### Ramka filmu

Stała `FILM` w `Promocja.tsx`: `null` albo `{ src, plakat }`. Dopóki `null`,
ramka jest **niska** (pasek „Film tej edycji — wkrótce” z żabą, nie wielki
prostokąt 16:9). Z plikiem: `<video controls preload="none" poster=…>` 16:9,
bez autoodtwarzania. Podmiana filmu = wrzucenie plików do `public/film/`
i jedna linia.

### Podgląd linku i metadane

- `generateMetadata` zamiast stałej: opis bez miasta przed odsłoną ośrodka
  („23–25 października. Wyjazd integracyjny Samorządu Studentów UEW —
  zapisz się.”), z miastem po odsłonie.
- `opengraph-image` (1200×630): logo na zdjęciu z wyjazdu, bez miejsca
  i bez daty zapisów — jeden obraz na cały okres.

### Instagram i Facebook

Klucze `social_instagram`, `social_facebook` w `app_settings` (publiczny
odczyt), pola w Ustawieniach. Pusty adres = ikona się nie renderuje. Adres
musi zaczynać się od `https://www.instagram.com/` albo
`https://www.facebook.com/` (walidacja w formularzu i w bazie).

## 3. Żaba-przewodnik (plan 16b)

### Postać i grafika

Rysunkowa żaba w stylu przykładów właściciela (gruby czarny kontur, płaska
zieleń, koszulka), ale z **własnym pyszczkiem** — okrągłe oczy, uśmiech,
bez warg Pepe. Koszulka w kolorze rdzy landingu z napisem **JWK**.

Pipeline (zasada z `CLAUDE.md` — każdy etap do akceptacji właściciela przed
użyciem):

1. Przykład → jedna próba w Higgsfield (`nano_banana_pro`) → akceptacja postaci.
2. Z zatwierdzonej postaci pozy:
   - cykl chodu, 6–8 klatek, profil w prawo;
   - wskazywanie w dół (1–2 klatki);
   - 3–4 wygłupy po 4–6 klatek: podskok, machanie, taniec, potknięcie
     z otrzepaniem;
   - siedzenie z machaniem (hero);
   - trzymanie ramki (Zapowiedź).
3. Obróbka lokalna: przezroczystość, wyrównanie punktu zaczepienia (stopy),
   jeden arkusz klatek WebP na pozę (jedno pobranie), podgląd przed użyciem.

Budżet: kilkanaście do dwudziestu kilku kredytów; warianty tylko przy czymś,
co działa.

### Trasy i ruch

- **Trasy = dzielniki** między sekcjami (`DzielnikFala`, `Szewron`, `Skos`,
  `Lisc`). Każdy dzielnik dostaje trasę; widać najwyżej jedną żabę naraz.
- **Położenie z przewijania:** `x = postęp dzielnika przez okno` (0 — dzielnik
  wchodzi dołem ekranu, żaba za lewą krawędzią; 1 — dzielnik wychodzi górą,
  żaba za prawą).
- **Klatka z odległości:** indeks klatki chodu = przebyta droga / długość
  kroku, więc nogi nie ślizgają się; zatrzymanie przewijania = żaba stoi.
- **Kierunek:** przewijanie w górę odwraca żabę i idzie ona w lewo.
- **Wskazywanie:** na trasie tuż przed zasłoną (ośrodek, cena) i przed
  licznikiem zapisów żaba w przedziale postępu 0,45–0,6 stoi i wskazuje
  w dół; dalsze przewijanie rusza ją dalej. Po odsłonie danej sekcji
  wskazywanie przy niej znika.
- **Wygłupy:** 4 s bez przewijania, gdy żaba jest na ekranie → losowy wygłup
  (animacja w czasie, nie w przewijaniu); dotknięcie żaby → wygłup od razu.
- **Hero:** żaba siedzi i macha; na pierwszej fali rusza w drogę.

### Technika

- Silnik jako czyste funkcje (`src/app/landing/zaba/ruch.ts`): postęp →
  położenie, droga → klatka, stan (idzie/stoi/wskazuje/wygłup). Komponent
  tylko rysuje.
- Jeden nasłuch przewijania z `requestAnimationFrame` dla wszystkich tras,
  `transform` zamiast `left/top`, pauza przy `visibilitychange` (jak liście).
- `prefers-reduced-motion`: żaba siedzi nieruchomo przy dzielnikach, bez
  chodu i bez samoczynnych wygłupów (dotknięcie nadal działa, jedna klatka).
- `aria-hidden`; dotyk łapie tylko obrys żaby, dzielniki nie mają linków.
- Rozmiar: ok. 88 px na telefonie, 120 px na komputerze.

### Poza zakresem

Pozostałe stany `Zaba` (tutorial, odmowa, czekanie, sukces) w `/wejscie`
i rejestracji — gotowa postać je ułatwi, ale to osobny krok.

## Obsługa błędów

| Sytuacja | Zachowanie |
|---|---|
| awaria odczytu dat odsłon | sekcje zakryte (bezpieczniej ukryć za długo niż odsłonić za wcześnie), licznik bez wartości |
| licznik na zerze, a serwer jeszcze nie odsłania (różnica zegarów) | `refresh` ponawiany co 5 s, najwyżej 6 razy |
| brak punktów harmonogramu na landingu | sekcja Plan się nie renderuje |
| brak adresów social | brak ikon |
| grafika żaby się nie wczyta | żaby nie ma, strona działa bez niej |

## Testy

1. **RLS zasłon (baza testowa):** `anon` przed datą nie czyta miejsca ani
   kluczy przelewu, po dacie czyta; data zapisów w przeszłości odsłania oba;
   admin czyta zawsze; zalogowany nie-admin jak `anon`.
2. **`odsloniete()` i lustro w TS:** reguła porządku, pusta data, strefa.
3. **Harmonogram:** `anon` widzi wyłącznie wiersze `na_landingu`.
4. **Maskowanie regulaminu:** § 1 ust. 3 bez miejsca przed odsłoną, pełny po.
5. **Przeciek w wyrenderowanym HTML-u** (krok weryfikacyjny na zbudowanej
   stronie, przed odsłoną): brak „Karpacz”, „Zielone Wzgórze”, „Poznańska”,
   kwoty i nazw plików zdjęć ośrodka w HTML-u, metadanych i podglądzie linku;
   brak słów motywu (sekta, rytuał, kapłan, sanktuarium, kult — bez względu
   na wielkość liter i odmianę).
6. **Social:** adres spoza dozwolonych domen odrzucony.
7. **Żaba — czyste funkcje:** położenie z postępu, klatka z drogi (brak
   ślizgu), odwrócenie kierunku, przedział wskazywania, wyłączenie ruchu przy
   ograniczonym ruchu.
8. **Przegląd na urządzeniu:** telefon (iPhone, Safari) i komputer — chód
   płynny, brak zasłaniania przycisków, odsłona z licznika bez przeładowania.
