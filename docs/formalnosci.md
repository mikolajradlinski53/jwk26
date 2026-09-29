# Formalności do dowiezienia

Żywa lista: co trzeba załatwić poza kodem, żeby apkę i wyjazd dało się
prowadzić legalnie i bez niespodzianek. Uzupełniana przy każdym planie.
Punkty oznaczone ⚖️ to pytania do działu prawnego UEW — lista je zgłasza,
niczego nie rozstrzyga.

Stan na 2026-09-29.

## Dokumenty dla uczestników

| # | Co | Stan | Kto / uwagi |
|---|---|---|---|
| 1 | **Regulamin wyjazdu** (`/regulamin`) | pełna treść § 1–22 od wersji zgód `2026-09-29.1` (`src/lib/regulamin.ts`), z nowym § 19 o aplikacji i treściach; `regulamin_zatwierdzony = false` blokuje otwarcie zapisów | zatwierdzenie przez Samorząd i dział prawny, potem przełącznik w panelu (Zapisy) |
| 2 | **Klauzula informacyjna RODO (art. 13)** przy zapisach | jest, wersja zgód `2026-09-28.2` (dopisany Google jako podmiot przetwarzający) | przegląd przez dział prawny; w repo nie piszemy, że ktokolwiek ją zatwierdził |
| 3 | **Polityka prywatności całej apki** | **brak** — klauzula przy zapisach opisuje tylko zgłoszenie | trzeba objąć: logowanie Google, zdjęcia w bingo i feedzie, głosy w gossipach (anonimowość wobec uczestników, nie wobec administratora), historia gier w kasynie, subskrypcje push, ranking, logi Vercela/Supabase, okresy przechowywania |
| 4 | **Obowiązek informacyjny wobec osoby ICE (art. 14)** | jest w specu zapisów | — |
| 5 | **Zgoda na dane zdrowotne (art. 9)** — dieta, alergie, choroby | jest, z retencją (`sprzataj-dane`, pg_cron) | sprawdzić po wyjeździe `cron.job_run_details` (następnego dnia i 9.11.2026) |
| 6 | **Zgoda na wizerunek** | jest, jedna i zbiorcza | ⚖️ feed pokazuje zdjęcia z bingo, na których mogą być osoby bez zgody — potrzebna zasada moderacji (admin nie akceptuje takich zdjęć albo je ukrywa) i zdanie o tym w regulaminie |
| 7 | **Zasady treści użytkowników** (feed, podpisy zdjęć, uzasadnienia w gossipach) | moderacja w panelu (ukrywanie uzasadnień, akceptacja zdjęć); zasady w regulaminie § 19 ust. 3–6 | — |
| 8 | **Oświadczenie o odpowiedzialności za szkody** | jest w zapisach; od `2026-09-29.1` odsyła do § 13, bez solidarnej odpowiedzialności za pokój | — |
| 9 | **Zgoda na SMS** | jest w zapisach (`sms_consent`) | ma znaczenie tylko, jeśli ruszy plan 16 (SMSAPI) |
| 10 | **Ciasteczka** | apka używa wyłącznie niezbędnych (sesja logowania) — baner zgody niepotrzebny | jeśli kiedyś dojdzie analityka, ten punkt wraca |

## Podmioty przetwarzające i usługi

| # | Usługa | Po co | Uwagi |
|---|---|---|---|
| 11 | Supabase (UE, Frankfurt) | baza, logowanie, pliki | umowa powierzenia (DPA) w ramach regulaminu usługi; plan darmowy — zob. pojemność niżej |
| 12 | Vercel | hosting apki | ⚖️ plan Hobby jest „do użytku niekomercyjnego” — wyjazd samorządu z wpłatami uczestników warto potwierdzić albo przejść na Pro na czas wyjazdu; część ruchu poza EOG (standardowe klauzule umowne) |
| 13 | Google (logowanie, arkusz zespołu) | logowanie kontem domenowym, arkusz zapisów | arkusz udostępniany wyłącznie imiennie |
| 14 | Resend | maile z kodem logowania (furtka awaryjna) | poza EOG; plan darmowy: 100 maili dziennie |
| 15 | SMSAPI | SMS-y (plan 16) | tylko jeśli powstanie konto; nadawca „JWK26” wymaga zatwierdzenia (1–3 dni) |

⚖️ **Kto jest administratorem danych** (Samorząd jako jednostka UEW czy sama
Uczelnia) i czy przetwarzanie trzeba wpisać do rejestru czynności UEW — do
potwierdzenia; od tego zależy treść klauzuli i polityki prywatności.

## Mechanizmy wymagające opinii

| # | Co | Pytanie |
|---|---|---|
| 16 | **Kasyno** (sloty, blackjack) | ⚖️ punkty z gier losowych można wydać w sklepiku na nagrody rzeczowe. Punktów nie kupuje się za pieniądze, ale to trzeba potwierdzić wobec ustawy o grach hazardowych (gry losowe o wygrane rzeczowe) |
| 17 | **Alkohol w sklepiku** (wódka, wino, piwo za punkty) | ⚖️ wydawanie alkoholu jako nagrody — ustawa o wychowaniu w trzeźwości; także zasady ośrodka i Uczelni. Wiek 18+ jest sprawdzany przy zapisach |
| 18 | **Wpłaty** | potwierdzenia przelewów trafiają do apki jako zdjęcia; rozliczenie i księgowość poza apką |

## Poza apką (do potwierdzenia, czy to na tej liście)

- ubezpieczenie NNW uczestników;
- lista uczestników i diet dla ośrodka (eksport CSV jest w panelu);
- umowa z ośrodkiem i przewoźnikiem.

## Pojemność planów darmowych (60 osób)

Szczegóły i decyzje — w specu wyglądu (plan 15), sekcja o feedzie. W skrócie:
baza, logowanie i realtime mają duży zapas; ciasnym miejscem jest **transfer
plików** (5 GB/mies. w Supabase Free) przy oglądaniu zdjęć w feedzie. Filmy
przekroczyłyby go szybko.
