# Licytacje zamiast sklepiku — projekt

Data: 2026-10-22. Wyjazd startuje 2026-10-23 o 11:00 — licytacje mają działać na wyjeździe.

## Po co

Sklepik (kapitan kupuje przedmiot za punkty drużyny po stałej cenie) zastępujemy licytacjami:
przedmiot wystawia admin, drużyny przebijają się ofertami, wygrywa najwyższa oferta w chwili
zamknięcia. Chodzi o emocje i rywalizację między drużynami o te same przedmioty — o to, żeby
punkty z gier miały na co iść i żeby było o co się kłócić.

## Cele

- Admin wystawia przedmiot na licytację: grafika, opis, cena wywoławcza, godzina otwarcia,
  godzina zamknięcia.
- Licytuje drużyna — w jej imieniu **kapitan** (ten sam kapitan co dziś w sklepiku).
- Płaci się punktami drużyny (tymi z rankingu, `points_ledger`).
- Wszyscy widzą aktualną najwyższą ofertę, drużynę, która ją złożyła, i czas do końca.
- Licytacja zamyka się sama o godzinie ustawionej przez admina. Zwycięzca płaci swoją ofertę
  i dostaje przedmiot.
- Powiadomienia: otwarcie licytacji (wszyscy), przebicie (drużyna przebita), wynik (wszyscy).
- Wystawiane są dotychczasowe przedmioty sklepiku (Błogosławieństwo, Tarcza, Klątwa, Kielich,
  Eliksir Czuwania itd.) — po wygranej działają tak jak dziś po zakupie. Admin może też dodać
  nowy przedmiot z własną grafiką.
- Klątwa: zwycięzca **po wygranej** wybiera ofiarę z listy drużyn (jak dziś przy zakupie).

## Nie-cele

- Zwykły sklepik z kupowaniem po stałej cenie — **znika** (decyzja Mikołaja). Ekran
  `/app/sklep` staje się ekranem licytacji.
- Licytacje indywidualne (osoba za własne punkty) — licytuje tylko drużyna.
- Licytacja w ciemno / oferty ukryte.
- Automatyczne przedłużanie przy ofercie w ostatniej chwili — koniec jest o godzinie admina
  (Mikołaj: „kończy się o określonym czasie przez admina”).

## Czego nie wolno zepsuć (anty-cele)

- Drużyna nie może wygrać bez pokrycia: suma jej prowadzących ofert nie może przekroczyć salda.
- Dwie oferty w tej samej chwili nie mogą obie „wygrać” ani obie przejść poniżej kroku.
- Licytacja nie może zostać niezamknięta (wisieć po czasie) ani zamknąć się dwa razy
  (podwójne pobranie punktów).
- Ranking nie może się rozjechać: punkty schodzą z drużyny dopiero przy wygranej, jednym
  wpisem w księdze.

## Zasady licytacji (ustalone)

- **Kto:** kapitan drużyny uczestników. Kadra (drużyna ukryta, admini) nie licytuje — *moja
  decyzja: Kadra nie ma realnych punktów do wydania i psułaby rywalizację.*
- **Waluta:** punkty drużyny. Prowadząca oferta **blokuje** punkty: dostępne saldo =
  saldo z księgi − suma ofert, w których drużyna aktualnie prowadzi w otwartych licytacjach.
  Po przebiciu blokada znika. Do księgi nic nie trafia aż do zamknięcia.
- **Pierwsza oferta:** co najmniej cena wywoławcza.
- **Kolejne:** co najmniej aktualna najwyższa + krok. *Moja decyzja: krok 10 pkt, jedno
  ustawienie globalne `licytacja_krok` w `app_settings`, edytowalne.*
- Drużyna, która prowadzi, nie przebija samej siebie.
- Ofert nie da się wycofać.
- **Zamknięcie:** o `koniec` licytacja przechodzi w stan zamknięty. Jeśli są oferty —
  wygrywa najwyższa: jeden wpis w księdze `-oferta` dla drużyny (kategoria `licytacja`),
  zamówienie/realizacja przedmiotu jak przy dzisiejszym zakupie. Bez ofert — zamyka się bez
  zwycięzcy (admin może wystawić przedmiot ponownie).
- **Brak pokrycia przy zamknięciu** (decyzja Mikołaja): saldo mogło spaść po złożeniu oferty
  (kasyno, cudza Klątwa, kara od Kadry) — blokada nie zatrzymuje tych wydatków i ich nie
  zmieniamy. Przy zamknięciu idziemy od najwyższej oferty w dół: wygrywa pierwsza oferta,
  którą drużyna **w tej chwili** może zapłacić (saldo z księgi ≥ oferta). Każda drużyna liczy
  się swoją najwyższą ofertą; drużyna bez pokrycia odpada. Wymaga to trzymania wszystkich
  ofert (historia), nie tylko bieżącej najwyższej. Gdy nikt nie może zapłacić — bez
  zwycięzcy. Saldo nigdy nie schodzi poniżej zera przez licytację.
- **Klątwa:** po wygranej zamówienie czeka na wybór ofiary; kapitan zwycięzcy wybiera
  drużynę z listy (nie własną, nie Kadrę). Wtedy działa dzisiejsza logika (Tarcza pochłania
  albo ofiara traci punkty). Punkty zwycięzca płaci przy zamknięciu, nie przy wyborze ofiary.
  **Admin może wybrać ofiarę w imieniu zwycięzcy** z panelu (decyzja Mikołaja) — na wypadek,
  gdy kapitan nie wybiera. Bez limitu czasu i bez losowania.
- **Licytacja w ciemno** (decyzja Mikołaja, kontynuacja „ukrytych nagród” z 2026-10-08):
  przedmiot oznaczony jako ukryty jest na licytacji widoczny jako „Tajemnicza nagroda” —
  bez nazwy, opisu i grafiki (ukrycie w bazie, jak dziś: uczestnik nie dostaje tych pól).
  Oferty, drużyny i cena są jawne. Nazwa, opis i grafika odsłaniają się przy zamknięciu;
  powiadomienia przed zamknięciem nie zdradzają przedmiotu.
- **Efekty cyfrowe** (Błogosławieństwo, Tarcza…) włączają się przy zamknięciu.
  **Nagrody fizyczne** trafiają do kolejki wydań admina jak dziś.

## Admin

- Panel (zamiast dzisiejszego zarządzania półką): lista licytacji ze stanem (zapowiedziana /
  trwa / zamknięta), przycisk „Wystaw na licytację”.
- Wystawienie: wybór przedmiotu z listy (istniejące `shop_items`) **albo** nowy przedmiot
  (nazwa, opis, grafika, rodzaj efektu jak dziś); cena wywoławcza; otwarcie (od razu albo
  o godzinie); zamknięcie (godzina). Grafika — upload pliku.
- Admin może anulować trwającą licytację (bez zwycięzcy, blokady znikają) i zmienić godzinę
  zamknięcia trwającej. *Moja decyzja: na wypadek pomyłki na wyjeździe.*
- Przy wystawianiu: przełącznik „w ciemno” (tajemnicza nagroda).
- Wygrane Klątwy czekające na ofiarę: lista z wyborem drużyny w imieniu zwycięzcy.
- Kolejka wydań nagród fizycznych zostaje jak dziś.

## Uczestnicy (ekran „Licytacje”, dawny „Sklepik”)

- Saldo drużyny i **dostępne** saldo (po blokadach).
- Karty trwających licytacji: grafika, nazwa, opis, aktualna oferta i drużyna, licznik do
  końca, pole „Twoja oferta” (wstępnie wypełnione minimalną kwotą) — tylko dla kapitana;
  reszta drużyny widzi kartę bez przycisku i informację, kto jest kapitanem.
- Zapowiedziane: karta z grafiką, ceną wywoławczą i godziną otwarcia.
- Zakończone: kto wygrał i za ile (zastępuje dzisiejszą „Kronikę”).
- Wygrana Klątwa: na karcie przycisk „Wybierz ofiarę” dla kapitana zwycięzcy.
- Odświeżanie na żywo — *moja decyzja: subskrypcja realtime na ofertach + odświeżenie przy
  powrocie do apki; licytacja żyje minutami, nie sekundami.*

## Powiadomienia (istniejący outbox `powiadomienia` → push)

- Otwarcie licytacji → wszyscy: „Licytacja: <przedmiot> — cena wywoławcza X pkt”.
- Przebicie → drużyna przebita: „Was przebito: <przedmiot> — teraz X pkt (<drużyna>)”.
- Zamknięcie → wszyscy: „<drużyna> wygrywa <przedmiot> za X pkt” (albo „bez ofert”).
- Klątwa po wyborze ofiary → ofiara (jak dziś).

## Ograniczenia techniczne / jak (ustalone przez istniejący projekt)

- Next.js (wersja z repo), Supabase (Postgres + RLS + RPC), testy bazy w `tests/db`
  (vitest), wdrożenie: migracja na test → testy → prod → push (Vercel).
- Logika ofert i zamknięcia w bazie (funkcje SECURITY DEFINER z blokadami, jak
  `kup_z_polki`), nie w kliencie.
- Zamykanie o czasie: zadanie `pg_cron` co minutę (jak `ogloszenia-planowane`) — zamknięcie
  najpóźniej ~1 min po czasie; ekran pokazuje „Zamykanie…” po upływie licznika. Oferta po
  czasie `koniec` jest odrzucana przez bazę niezależnie od crona.
- Realizacja przedmiotu po wygranej korzysta z tej samej logiki co dziś (efekty, Tarcza
  przy Klątwie, kolejka wydań) — wspólna funkcja zamiast kopii.
- Dzisiejsze dane sklepiku (przedmioty) zostają jako katalog przedmiotów do wystawiania.

## Decyzje budującego (do wiadomości)

- `stock` przedmiotu traci znaczenie — każda licytacja to jedna sztuka; ten sam przedmiot
  można wystawić wiele razy.
- Przedmioty bez grafiki (dziś mają tylko `ikona`) pokazują dotychczasową ikonę.
- Drużyna bez kapitana nie licytuje (przycisk ukryty, baza odrzuca).
- Stare `shop_orders` i kronika zostają w bazie, ekran ich nie pokazuje.

## Zostawione budującemu

- Kształt tabel (np. `licytacje`, `licytacje_oferty`), nazwy funkcji, bucket na grafiki.
- Układ kart i panelu w stylu apki (szkło, krew, kość — jak reszta ekranów).
- Teksty komunikatów błędów po polsku, w tonie apki.
- Co zrobić z dotychczasowymi `shop_orders` i kroniką (zostawić w bazie, nie pokazywać).
