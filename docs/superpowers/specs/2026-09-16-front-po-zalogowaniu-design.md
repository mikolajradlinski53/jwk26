# Front po zalogowaniu — spec projektowy

Data: 2026-09-16
Status: zatwierdzony do implementacji
Poprzedza: plan 03 („Rdzeń" z §9 speca głównego)

## 1. Czym to jest

Warstwa wizualna i nawigacyjna aplikacji **po wpuszczeniu użytkownika do środka**,
plus dwie funkcje, bez których ta warstwa nie ma czego pokazywać: ranking na żywo
i pełny panel admina. To jest krok 3 z §9 speca głównego
(`2026-09-14-sekta-wyjazdowa-design.md`), poprowadzony od strony projektowej.

Kierunek został zatwierdzony na makiecie czterech ekranów, nie na opisie.

## 2. Zakres

**W zakresie:**

- system projektowy: tokeny koloru, typografii, zaokrągleń i szkła
- powłoka aplikacji: pływający pasek nawigacji z ikonami, obszar treści
- ranking na żywo (realtime zamiast statycznego odczytu)
- pełny panel admina: kolejka zgłoszeń, przyznawanie punktów, drużyny
- przebudowa istniejących ekranów: `/` (ranking), `/rejestracja`, `/admin/*`
- ekrany-zaślepki dla tras, które dopiero powstaną: `/bingo`, `/feed`, `/shop`, `/wiecej`

**Poza zakresem, świadomie:**

- **Landing page** ze scrollowym wjazdem kamery w obraz. Odłożony na osobny spec —
  wymaga grafik z Higgsfielda i dotyczy innej widowni niż apka.
- **Ekran logowania.** Zostaje jak jest do czasu, aż ruszy własny SMTP; wcześniej
  i tak nie da się go przetestować na prawdziwych ludziach.
- Treść zakładek Bingo, Feed, Sklep — to plany 04 i 05. Tu powstają tylko ich
  miejsca w nawigacji i stany puste.

## 3. Kierunek wizualny

Czerń i krew, wszystko zaokrąglone, szkła maksymalnie. Rytuał niesie typografia
tytułów i język interfejsu, nie ornament.

### D1. Światło mieszka w tle aplikacji, nie na ekranach

Pod całą aplikacją leży mocno rozmyta poświata w dwóch czerwieniach, przypięta do
powłoki. Bez niej `backdrop-filter` nie ma czego rozmywać i szkło zamienia się
w szarą płytę.

**Dlaczego tak:** alternatywą było dekorowanie każdego ekranu z osobna, co znaczy
tyle samo pracy przy każdym nowym widoku i nieuchronne rozjechanie się stylów.
Jedno tło w powłoce daje spójność za darmo i sprawia, że nowe ekrany są szklane
od pierwszej linii kodu.

### D2. Czerwony występuje wyłącznie tam, gdzie coś znaczy

Cztery miejsca: akcja główna, aktywna zakładka, lider rankingu, ostrzeżenie.
Nigdzie indziej.

**Dlaczego tak:** aplikacja jest używana po ciemku, na telefonie, często po
alkoholu. Kolor jest tu nawigacją, nie ozdobą — rozsypany po interfejsie
przestaje cokolwiek znaczyć.

### D3. Pasek nawigacji pływa

Pasek nie dotyka krawędzi ekranu: ma margines dookoła i pełne zaokrąglenie.

**Dlaczego tak:** pasek docięty do dołu nie ma pod sobą treści, więc rozmycie nie
działa i szkło znika. Margines jest warunkiem istnienia efektu, nie stylizacją.

### D4. Ikony bez podpisów

Pięć ikon, zero tekstu. Nazwy zostają w `aria-label` i w tekście dla czytników
ekranu.

### D5. Bodoni tylko duży

Krój tytułowy (`Bodoni Moda`) pojawia się wyłącznie w dużych rozmiarach: nagłówek
ekranu, numer miejsca w rankingu, wynik. Interfejs jest w `Manrope`.

**Dlaczego tak:** Bodoni ma włoski, które na rozmyciu wyglądają jak rytowane — i te
same włoski znikają przy 12 px na szklanym tle. Ograniczenie do dużych rozmiarów
jest warunkiem czytelności, nie gustem.

## 4. Tokeny

```
--noc        #0c0709   tło aplikacji (czerń z odchyleniem w czerwień)
--noc-glab   #060304   tło poza powłoką
--krew       #c8102e   akcent jedyny
--krew-glab  #6e0a1a   druga czerwień, do poświaty i gradientów
--kosc       #f4eeeb   tekst główny
--dym        #9c8b8e   tekst drugorzędny (szary z odchyleniem w czerwień)

--szklo        rgb(255 255 255 / 0.07)
--szklo-mocne  rgb(255 255 255 / 0.12)
--szklo-kraw   rgb(255 255 255 / 0.16)
--szklo-blysk  rgb(255 255 255 / 0.34)   wewnętrzna krawędź od góry

--r-s 14px · --r-m 20px · --r-l 28px · --r-pill 999px
```

Kroje: `Bodoni Moda` (tytuły) i `Manrope` (interfejs), oba przez `next/font`.
Zastępują `Cinzel` i `Inter` z planu 01 — **globalnie, także na ekranie logowania**.
Logowanie jest wyłączone z przebudowy układu i treści, ale kroje i tokeny są
zdefiniowane w warstwie globalnej, więc odziedziczy nowy wygląd typografii. Nie
utrzymujemy dwóch zestawów krojów naraz: koszt jest realny (dwa dodatkowe pliki
fontów na każdym wejściu), a zysk żaden.

Szkło to zawsze ten sam zestaw: tło `--szklo`, obramowanie `--szklo-kraw`,
`backdrop-filter: blur(20px) saturate(170%)` i wewnętrzny blask od góry. Jeden
komponent, nie powtarzane klasy.

## 5. Nawigacja

```
Ranking · Bingo · Feed · Sklep · Więcej
```

Ekranem domyślnym po zalogowaniu jest **Ranking**. „Więcej" jest szufladą: profil,
saldo, historia punktów, ustawienia powiadomień, a w przyszłości kasyno (plan 06)
i gossipy (plan 07).

**Dlaczego szuflada:** pasek ma pięć miejsc, a spec przewiduje docelowo osiem
obszarów. Bez szuflady za dwa plany trzeba by przebudowywać nawigację, czyli
dotykać każdego ekranu drugi raz.

Pasek jest widoczny wyłącznie dla osób z `status = 'approved'`. Na `/rejestracja`
i `/login` nie ma dokąd nawigować, więc paska nie ma.

Wejście do panelu admina zostaje tam, gdzie jest dzisiaj — w profilu, czyli pod
zakładką „Więcej" — i tylko dla `role = 'admin'`.

## 6. Ranking na żywo

Ranking przestaje być statycznym odczytem. Klient subskrybuje `postgres_changes`
na `points_ledger` i po każdej zmianie odświeża widok `team_scores`.

Subskrypcja dotyczy `points_ledger`, nie widoku — Supabase nie wysyła zdarzeń
z widoków. Zdarzenie niesie tylko sygnał „coś się zmieniło"; wynik pobieramy
ponownie zapytaniem, bo suma po drużynie i tak liczy się w bazie.

Wiersz, którego wynik się zmienił, dostaje krótki błysk. **Nie animujemy
przestawienia pozycji** — wymagałoby to techniki FLIP z pomiarem każdego wiersza
przed i po zmianie, co przy czterech drużynach jest nieproporcjonalne do zysku.
Błysk niesie tę samą informację: tu coś się przed chwilą zdarzyło.

Przy `prefers-reduced-motion` błysk nie występuje.

Kryterium ze speca głównego §12.3: ranking aktualizuje się w drugiej karcie bez
odświeżania.

## 7. Panel admina

Rozszerzenie tego, co powstało w planie 02:

- **Zgłoszenia** — kolejka, już istnieje, dostaje nowy wygląd
- **Punkty** — przyznanie dowolnej liczby punktów osobie lub drużynie
  z obowiązkowym uzasadnieniem, `category = 'admin_adjust'`
- **Historia** — ostatnie wpisy z `points_ledger`, tylko do odczytu

**Drużyny bez własnego ekranu.** Migracja 0001 zasiewa cztery drużyny, a polityka
`teams_admin_write` już pozwala adminowi je zmieniać. Ekran do tego byłby
zbudowany na zapas: przed wyjazdem drużyny ustala się raz, a zmiana nazwy czy
koloru to jedno zapytanie w SQL Editorze. Politykę mimo to obejmujemy testem, bo
dziś nikt jej nie pilnuje — dzięki temu ekran da się dołożyć później bez ruszania
bazy.

Przyznawanie punktów idzie przez funkcję `SECURITY DEFINER`, nie bezpośrednim
`INSERT`. RLS przepuszcza wprawdzie `INSERT` adminowi, ale funkcja daje jedno
miejsce na walidację i pozwala późniejszym źródłom punktów (bingo, sklepik)
korzystać z tej samej ścieżki.

## 8. Wydajność i zgodność

**`backdrop-filter` bez wsparcia.** Przy braku obsługi szkło degraduje się do
panelu o wyższej nieprzezroczystości, z tym samym obramowaniem i zaokrągleniem.
Realizowane przez `@supports not (backdrop-filter: blur(1px))`. Tekst musi
pozostać czytelny w obu wariantach.

**Koszt rozmycia przy przewijaniu.** Wiele warstw `backdrop-filter` na
przewijanej liście to klasyczne źródło zacięć na telefonach ze średniej półki.
Szkło na elementach stałych (paski, przyciski, arkusze) zostaje bezwarunkowo.
Szkło na kartach listy zostaje, ale podlega sprawdzeniu na prawdziwym telefonie;
jeśli przewijanie gubi płynność, karty przechodzą na wariant matowy przez zmianę
jednego tokenu, bez ruszania układu.

**Cele dotykowe** minimum 44 px, zgodnie z §8 speca głównego.

## 9. Testy

Warstwy wizualnej nie testujemy automatycznie — to koszt bez pokrycia przy tej
skali i tym terminie.

Testami obejmujemy to, co dokłada logikę:

- funkcja przyznająca punkty: odmowa dla nie-admina, wymóg uzasadnienia, poprawny
  wpis w `points_ledger`
- zarządzanie drużynami: uczestnik nie założy ani nie zmieni drużyny

Bramka (`gate.ts`, `proxy.ts`) pozostaje **bez testów automatycznych** — to
middleware Next.js, którego sprawdzenie wymagałoby narzędzia do testów
end-to-end, a tego w stacku nie ma i nie warto go dokładać przed wyjazdem. To, że
uczestnik nie widzi tras panelu, potwierdzamy ręcznie przy weryfikacji.

Realtime sprawdzamy ręcznie, w dwóch kartach — automatyzacja subskrypcji
WebSocket w Vitest kosztuje więcej, niż jest tu warta.

## 10. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Szkło ścina płynność na starszych Androidach | Karty listy przechodzą na wariant matowy jednym tokenem (§8) |
| Bodoni nieczytelny w małych rozmiarach | Ograniczony do nagłówków i liczb (D5) |
| Realtime nie dociera przy słabym zasięgu | Odczyt przy wejściu na ekran zostaje; subskrypcja tylko go uzupełnia |
| Pasek zasłania treść na krótkich ekranach | Obszar treści ma dolny odstęp równy wysokości paska z marginesem |
| Przebudowa wygląda gorzej na produkcji niż w makiecie | Weryfikacja z telefonu przed uznaniem planu za skończony |

## 11. Kryteria ukończenia

1. Po zalogowaniu osoba zaakceptowana ląduje na rankingu z pływającym paskiem.
2. Punkt przyznany przez admina pojawia się w drugiej karcie bez odświeżania.
3. Pasek nie jest widoczny dla osoby ze statusem innym niż `approved`.
4. Uczestnik bez roli admina nie widzi w „Więcej" wejścia do panelu.
5. Admin przyznaje punkty z uzasadnieniem i widzi je w historii.
6. Przy wyłączonej obsłudze `backdrop-filter` cały interfejs pozostaje czytelny.
7. Na telefonie przewijanie rankingu i kolejki zgłoszeń jest płynne.
8. `prefers-reduced-motion` wyłącza błysk na zmienionym wierszu rankingu.
