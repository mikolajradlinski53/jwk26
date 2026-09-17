# Preludium — landing, zamek instalacji i logowanie Google

**Data:** 2026-09-17
**Stan:** zatwierdzony do rozpisania planu

## Po co to jest

Dziś do apki nie da się wejść. Logowanie chodzi na jednorazowych kodach
wysyłanych mailem, a wbudowany mailer Supabase wysyła dwa maile na godzinę
i wyłącznie do członków zespołu projektu. W produkcji jest z tego powodu
**jedno konto — właściciela**. Sześćdziesiąt kilka osób nie ma jak się zalogować.

Jednocześnie apka nie ma żadnego przedsionka. Kto dostanie link, trafia prosto
na ekran logowania — bez wyjaśnienia, czym to jest, bez regulaminu, bez
możliwości pokazania wydarzenia komukolwiek z zewnątrz.

Ten spec zamyka obie sprawy jednym ruchem, bo to jedna droga: od kliknięcia
w link z Instagrama do pierwszego ekranu w apce.

## Zakres

**Wchodzi:** landing page, tutorial przypinania do ekranu głównego, zamek
uruchamiania apki wyłącznie w trybie aplikacji, logowanie przez Google
Workspace, przenosiny tras apki pod `/app`, dwa liczniki, konfigurowalne daty.

**Nie wchodzi i dostanie własne speki:** powiadomienia push, gry (hazard
i mini gierka), sklepik, harmonogram wewnątrz apki, rozkład pokoi, zasady
w apce, dodatkowe animacje ekranów po zalogowaniu.

**Zostaje bez zmian:** dowód wpłaty z rozpoznawaniem tekstu, akceptacja przez
admina, przypisanie do drużyny, wszystko za bramką (ranking, bingo, feed,
punkty, panel admina).

## Droga użytkownika

```
link z Instagrama
  └─ przeglądarka wbudowana w Instagrama
      └─ „ta strona wymaga Safari/Chrome"        [inaczej ślepy zaułek]
          └─ landing: jesień, żaba, promo, regulamin, harmonogram, liczniki
              └─ „Wejdź do Sekty" → /wejscie
                  └─ tryb przeglądarki: tutorial przypinania
                      └─ apka uruchomiona z ekranu głównego
                          └─ logowanie Google
                              └─ dowód wpłaty, telefon, zgoda SMS
                                  └─ akceptacja admina, drużyna
                                      └─ /app
```

Cztery ostatnie kroki już istnieją i działają. Ten spec wymienia całą resztę.

## Trasy i bramka

| Trasa | Kto widzi | Uwagi |
|---|---|---|
| `/` | wszyscy | landing |
| `/regulamin` | wszyscy | osobna trasa, żeby dała się linkować |
| `/wejscie` | wszyscy | dwa oblicza: tutorial albo logowanie |
| `/auth/callback` | wszyscy | powrót od Google |
| `/app/**` | zalogowani z domeny | wszystko po zalogowaniu |

### Dlaczego apka przenosi się pod `/app`

Dziś `proxy.ts` mówi „chroń wszystko oprócz wypisanych wyjątków". Każda nowa
publiczna trasa to dopisek do wyrażenia regularnego, a każda pomyłka w tym
wyrażeniu otwiera coś, co miało zostać zamknięte. W trakcie prac nad planem 04
trzykrotnie trzeba było przepuszczać przez tę listę trasę podglądu — za każdym
razem ręcznie, i za każdym razem był to moment, w którym dało się o czymś
zapomnieć.

Po przenosinach reguła brzmi „chroń `/app`" i nie ma wyjątków. Wszystko poza
tym prefiksem jest publiczne z założenia, nie przez przeoczenie.

Koszt przenosin jest **dziś zerowy**: jedno konto w bazie, zero zakładek, zero
przypiętych aplikacji. Za dwa tygodnie ten sam ruch łamałby ludziom skróty
na ekranach głównych.

Mapowanie: `src/app/(apka)/**` → `src/app/app/**`, `src/app/rejestracja`
→ `src/app/app/rejestracja`. Ranking, dziś pod `/`, ląduje pod `/app`.
`start_url` w manifeście wskazuje `/app`, żeby przypięta apka pomijała landing.

### Test zamiast pamięci

Bramka dostaje test, który przechodzi po plikach tras pod `src/app/app/`
i dla każdej sprawdza, że niezalogowany zostaje odbity. Nowy ekran dołożony
za pół roku bez bramki wywali ten test, zamiast po cichu wyciec.

## Zamek instalacji

Apka uruchamia się wyłącznie w trybie aplikacji. W zwykłej karcie przeglądarki
`/wejscie` pokazuje tutorial przypinania zamiast przycisku logowania, a każda
trasa pod `/app` — sam tutorial zamiast treści.

**Landing zamka nie dotyczy.** `/` i `/regulamin` muszą działać w zwykłej karcie,
bo to jest ich jedyny sens: ktoś ma tam trafić z Instagrama, zanim cokolwiek
zainstaluje. Zamek zaczyna się dopiero przy `/wejscie`.

**Decyduje CSS, nie JavaScript.** `@media (display-mode: browser)` pokazuje
tutorial, `@media (display-mode: standalone)` pokazuje logowanie. Skrypt nie
bierze udziału w tej decyzji, więc nie ma błysku niewłaściwej treści przed
uruchomieniem JavaScriptu. Skrypt służy wyłącznie do rozpoznania systemu
(inna instrukcja na iOS, inna na Androidzie) i do wykrycia przeglądarki
wbudowanej w aplikację.

**Wyjątek dla szerokich ekranów.** Zamek działa tylko poniżej 900 px szerokości.
Panel admina obsługuje się z laptopa, gdzie `display-mode` jest zawsze
`browser` — bez tego wyjątku właściciel zamknąłby sam siebie poza kolejką bingo.

To bramka wygody, nie bezpieczeństwa: treść apki i tak jest chroniona
logowaniem po stronie serwera. CSS ukrywa, a nie strzeże, i tak ma być.

### Przeglądarka wbudowana w Instagrama

Nie potrafi instalować aplikacji na ekranie głównym. Skoro promocja idzie przez
Instagram, to najczęstsza droga wejścia kończy się ślepo — i wygląda dla
człowieka jak zepsuta strona, nie jak brakujący krok.

Landing i `/wejscie` rozpoznają ten kontekst po `navigator.userAgent`
(`Instagram`, `FBAN`, `FBAV`, `Messenger`) i **zanim** zaczną tłumaczyć
przypinanie, mówią „otwórz tę stronę w Safari albo Chrome", z przyciskiem
kopiującym adres do schowka.

### Instrukcje osobne dla każdego systemu

Jedna uniwersalna grafika „kliknij Udostępnij" nie zadziała na połowie
telefonów. Tutorial ma dwa warianty, wybierane po systemie:

- **iOS Safari:** przycisk Udostępnij na dolnym pasku → „Do ekranu
  początkowego" → Dodaj.
- **Android Chrome:** menu trzech kropek → „Zainstaluj aplikację" albo
  „Dodaj do ekranu głównego".

Na Androidzie dodatkowo podpinamy zdarzenie `beforeinstallprompt`: jeśli
przeglądarka je zgłosi, tutorial dostaje prawdziwy przycisk instalacji zamiast
opisu. Na iOS takiego zdarzenia nie ma i nie będzie — tam zostaje instrukcja.

## Logowanie

Dostawca Google w Supabase, z parametrem `hd=samorzad.ue.wroc.pl`.

**Gdzie naprawdę stoi bramka domenowa.** `hd` jest wyłącznie podpowiedzią dla
ekranu wyboru konta i da się go obejść. Prawdziwą granicą jest istniejący
wyzwalacz `enforce_email_domain` z migracji 0001, który siedzi na
`before insert on auth.users` i odpala się przy każdym tworzeniu konta,
niezależnie od dostawcy. Nie wymaga zmiany — trzeba go tylko pokryć testem
dla ścieżki OAuth, żeby nikt go później nie ruszył w dobrej wierze.

**Gdy ktoś wejdzie prywatnym Gmailem**, wyzwalacz rzuci wyjątek, a Supabase
odeśle użytkownika na `/auth/callback` z błędem. Ekran powrotu ma przetłumaczyć
to na jedno zdanie — „ten adres nie należy do Samorządu, zaloguj się kontem
@samorzad.ue.wroc.pl" — zamiast pokazać surowy komunikat OAuth. Żaba
w stanie „odmowa" siedzi obok.

**Logowanie mailem zostaje włączone, ale ukryte** — jako furtka awaryjna dla
właściciela, dostępna pod `/wejscie?awaria=1`. Wbudowany mailer Supabase dowozi
do członków zespołu projektu, więc ta furtka działa bez własnego SMTP.

Po udanym logowaniu istniejąca logika kieruje dalej bez zmian: brak profilu
albo status inny niż zaakceptowany prowadzi na rejestrację, zaakceptowany
na `/app`.

## Landing

Jedna długa strona ze zjazdem w dół, poza regulaminem, który dostaje własną
trasę do linkowania.

Kolejność sekcji:

0. **Nagłówek** — przyklejony do góry, przezroczysty nad treścią. Po lewej
   znak wydarzenia, po prawej przycisk „Zaloguj". Ten przycisk jest widoczny
   przez cały zjazd w dół, bo część osób zna już wydarzenie i wchodzi wyłącznie
   po to, żeby się dostać do środka — nie mają powodu szukać wezwania ukrytego
   gdzieś w treści. Prowadzi w to samo miejsce co duży przycisk w sekcji
   wejściowej, czyli na `/wejscie`.
1. **Wejście** — żaba, nazwa wydarzenia, licznik do JWK, przycisk „Wejdź
   do Sekty". Ten ekran musi być czytelny w pierwszej klatce, bez czekania
   na animację.
2. **Czym to jest** — krótki opis wyjazdu.
3. **Promocja** — miejsce na zdjęcia i filmy. Materiały wideo ładowane leniwie,
   z plakatem zamiast automatycznego odtwarzania.
4. **Kiedy i gdzie** — daty, miejsce, krótki kalendarz z ramowym planem.
5. **Drugi licznik** — do przyjęcia świeżaków.
6. **Regulamin** — skrót i odnośnik do `/regulamin`.
7. **Stopka** — kontakt.

### Spadające liście

Rysowane na kanwie, nie jako osobne elementy strony. Warstwa dekoracyjna
z `aria-hidden`, całkowicie wyłączana przy `prefers-reduced-motion` — reguła
globalna w `globals.css` już to wymusza dla animacji CSS, ale kanwa musi
sprawdzić to sama, bo jej ta reguła nie dotyczy.

Animacja zatrzymuje się, gdy karta jest niewidoczna (`visibilitychange`), i
zmniejsza liczbę liści, gdy urządzenie zgłasza mało rdzeni
(`navigator.hardwareConcurrency <= 4`). Bez tego dekoracja zjada baterię
na słabszych telefonach, a to są telefony części uczestników.

### Liczniki

Dwa: do rozpoczęcia JWK i do przyjęcia świeżaków.

Liczą względem **strefy Europe/Warsaw**, nie UTC. Daty trzymane są jako pełne
znaczniki czasu z przesunięciem, żeby nie zależeć od strefy przeglądarki
uczestnika ani serwera.

Gdy data minie, licznik nie pokazuje wartości ujemnej — przełącza się na
komunikat („trwa" albo „już za nami"). To nie jest przypadek teoretyczny:
świeżaki przyjmowane są tydzień przed wyjazdem, więc pierwszy licznik wygaśnie,
gdy drugi jeszcze będzie chodził.

## Maskotka

Żaba w jesiennym motywie, obecna w kilku miejscach, zawsze w jednym
z określonych stanów. Spec definiuje **gniazda i stany**, nie wygląd —
warstwę graficzną dostarcza właściciel.

| Stan | Gdzie |
|---|---|
| `powitanie` | wejście na landing |
| `tutorial` | ekran przypinania |
| `odmowa` | błąd domeny po logowaniu |
| `czekanie` | rejestracja złożona, czeka na akceptację |
| `sukces` | pierwsze wejście do apki |

Komponent `Zaba` przyjmuje `stan` i renderuje grafikę z katalogu publicznego.
**Dopóki grafiki nie ma, renderuje prostą sylwetkę zastępczą** — żeby brak
rysunku nie blokował budowy ani nie wysypywał ekranu.

## Dane konfigurowalne

Do tabeli `app_settings`, która już istnieje:

| Klucz | Wartość początkowa | Znaczenie |
|---|---|---|
| `data_jwk` | `2026-10-23T18:00:00+02:00` | początek wyjazdu |
| `data_swiezakow` | `2026-10-16T18:00:00+02:00` | przyjęcie świeżaków |
| `miejsce_nazwa` | `OW Zielone Wzgórze` | nazwa ośrodka |
| `miejsce_adres` | `Poznańska 5, 58-540 Karpacz` | adres na landingu |

Sekcja „Kiedy i gdzie" pokazuje nazwę, adres i odnośnik do map. Jeśli
którakolwiek wartość jest pusta, sekcja renderuje samo to, co ma — bez pustego
nagłówka i bez łamania układu.

Obie daty wypadają przed zmianą czasu 25 października 2026, więc przesunięcie
`+02:00` jest poprawne dla obu.

Godziny są przybliżone i **zmienialne bez wdrożenia** — panel admina dostaje
mały formularz `/app/admin/ustawienia` z tymi czterema polami. Bez niego każda
zmiana godziny wymagałaby zapytania SQL, a to czyni właściciela zależnym
od programisty w sprawie, która powinna zająć dziesięć sekund.

## Obsługa błędów

| Sytuacja | Co widzi człowiek |
|---|---|
| obca domena | „ten adres nie należy do Samorządu…", żaba w stanie odmowy |
| logowanie przerwane | powrót na `/wejscie` bez komunikatu o błędzie |
| awaria odczytu ustawień | landing pokazuje się bez liczników, nie pusta strona |
| przeglądarka w Instagramie | instrukcja otwarcia w Safari/Chrome przed tutorialem |
| przeglądarka bez instalacji | tutorial mówi wprost, czego brakuje |

Zasada z planu 04 obowiązuje dalej: **awaria odczytu nie może wyglądać jak
legalny pusty stan**. Landing bez liczników to degradacja, nie błąd — i tak
ma wyglądać, bo liczniki nie są powodem istnienia tej strony.

## Testy

1. **Bramka po przenosinach** — dla każdego pliku trasy pod `src/app/app/`
   niezalogowany zostaje odbity. Test wylicza trasy z systemu plików, więc nowy
   ekran bez bramki go wywali.
2. **Bramka domenowa dla OAuth** — wstawienie do `auth.users` konta spoza
   domeny kluczem serwisowym kończy się wyjątkiem z wyzwalacza. Dowodzi, że
   granica nie zależy od parametru `hd` po stronie przeglądarki.
3. **Liczniki** — data w przyszłości, data przeszła, oraz obie daty z tego
   wydarzenia. Sprawdza brak wartości ujemnych i poprawną strefę.
4. **Zamek instalacji** — krok weryfikacyjny po zbudowaniu, nie przypadek
   w Vitest: zbudowany arkusz CSS musi zawierać reguły dla obu wariantów
   `display-mode` oraz wyjątek szerokości. Sprawdzane na artefakcie budowania,
   nie na źródle, bo w tym repozytorium kaskada już dwa razy zjadła regułę,
   która w źródle wyglądała poprawnie — a Vitest nie widzi wyniku Tailwinda.

## Czego nie da się zrobić z kodu

Logowanie Google wymaga dwóch rzeczy skonfigurowanych ręcznie, poza
repozytorium, i **obie musi zrobić właściciel**, bo wymagają dostępu do konsol,
których program nie ma:

1. **Google Cloud** — projekt, ekran zgody i dane klienta OAuth, z adresem
   powrotnym wskazującym na `<projekt>.supabase.co/auth/v1/callback`.
2. **Supabase** — włączenie dostawcy Google i wklejenie identyfikatora oraz
   sekretu klienta.

Dopóki to nie stoi, przycisk logowania nie ma dokąd prowadzić. Plan umieszcza
te kroki na samym początku, z instrukcją klikaną krok po kroku, i dopiero za
nimi stawia sprawdzenie na telefonie.

## Ryzyko — ZAMKNIĘTE 17 września 2026

**Pytanie brzmiało: czy logowanie Google działa w apce przypiętej do ekranu
głównego na iPhonie. Odpowiedź: tak.** Sprawdzone na prawdziwym urządzeniu po
wdrożeniu Taska 3. Twardy zamek instalacji zostaje w projekcie bez zmian.

Przy okazji wyszło, że Google **sam** wymusza domenę — parametr `hd` nie
pozwolił wpisać innego adresu. Mamy więc dwie niezależne warstwy: ekran Google
i wyzwalacz w bazie. Ta druga nadal jest tą, na której polegamy, bo pierwszą da
się obejść pomijając parametr.

**To samo sprawdzenie wykryło błąd, którego nie znalazłoby żadne narzędzie:**
w trybie aplikacji ekran wyboru konta otwiera się jako nakładka nad tą samą,
żywą stroną — bez przeładowania. Stan „czekam", ustawiony przed
przekierowaniem, nie cofał się po powrocie i przycisk logowania zostawał
wyłączony na zawsze; apka wyglądała na zaciętą aż do ubicia procesu.
W przeglądarce objaw nie występuje, bo tam powrót oznacza pełne przeładowanie.

Wniosek na przyszłość dla całego projektu: **każdy stan blokujący interfejs,
ustawiany przed wyjściem na zewnętrzną domenę, musi mieć drogę powrotną przez
`visibilitychange` albo `pageshow`.** Licznik cofany po odpowiedzi serwera nie
wystarcza, bo odpowiedź może nigdy nie przyjść.

Poniżej zostaje oryginalny opis ryzyka — jako zapis tego, czego się
obawialiśmy i dlaczego sprawdzenie stało trzecie w planie, a nie ostatnie.

---

**Czy logowanie Google działa w apce przypiętej do ekranu głównego na iPhonie.**

Na iOS aplikacja z ekranu głównego ma osobny magazyn danych niż Safari.
Zalogowanie się na landingu w przeglądarce nie przenosi sesji do przypiętej
apki — człowiek musi zalogować się w środku. A logowanie Google to
przekierowanie na zewnętrzną domenę i z powrotem, co w trybie aplikacji na iOS
bywa kapryśne.

Przy twardym zamku **nie ma wtedy żadnej drogi objazdowej**: człowiek nie może
zalogować się w przeglądarce, bo zamek go nie wpuści, ani w apce, bo logowanie
nie wraca.

Dlatego pierwszy krok planu to sprawdzenie tego na prawdziwym iPhonie, zanim
powstanie choćby jedna klatka animacji. Jeśli okaże się zepsute, projekt zmienia
kształt — najpewniej przez dopuszczenie logowania w przeglądarce i przeniesienie
zamka za moment zalogowania.

## Decyzje i ich powody

| Decyzja | Powód |
|---|---|
| landing publiczny, apka za bramką | promocja zakłada widza z zewnątrz; dane uczestników nie |
| twardy zamek instalacji | świadomy wybór właściciela, mimo pokazanego ryzyka zablokowania osób z nietypowymi telefonami |
| zamek wyłącznie poniżej 900 px | panel admina obsługiwany z laptopa |
| zamek w CSS, nie w JavaScripcie | brak błysku niewłaściwej treści przed uruchomieniem skryptów |
| apka pod `/app` | reguła bramki z czarnej listy na jeden prefiks |
| logowanie mailem zostaje ukryte | furtka awaryjna dla właściciela, działa bez SMTP |
| daty w `app_settings` | zmiana godziny bez wdrożenia |
| żaba z sylwetką zastępczą | brak grafiki nie blokuje budowy |
