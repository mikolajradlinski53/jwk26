# Drużyny bez gotowych nazw: głosowanie na kapitana i nazwa od kapitana

Data: 2026-10-09 · Paczka C z listy poprawek Mikołaja (2026-10-07)

## Cel

Drużyny nie dostają gotowych nazw. Po ułożeniu składów drużyna sama wybiera
kapitana w aplikacji, a kapitan raz nadaje drużynie nazwę i motto. Ranking
pokazuje punkty drużyn; punkty pojedynczych osób znikają z widoku wspólnego.

## Decyzje (Mikołaj)

1. Przed nadaniem nazwy drużyna jest widoczna jako kolor + „Drużyna 1…4”.
2. Kapitana wybiera drużyna w głosowaniu w aplikacji.
3. Głosowanie zamyka się samo, gdy zagłosuje cały skład drużyny. Admin ma
   awaryjne „Zamknij teraz” (ktoś bez telefonu).
4. Remis rozstrzyga losowanie w bazie.
5. Kapitan ustawia raz nazwę (1–30 znaków) i motto (0–60 znaków); potem są
   zablokowane. Admin może odblokować nieodpowiednią nazwę.
6. Punkty osób widzi tylko właściciel (kasyno, „Więcej”); ranking pokazuje
   skład bez punktów. Kasyno bez zmian (gra z salda osoby).

## Założenia

- Ludzie trafiają do drużyn jak dziś: admin wybiera drużynę przy akceptacji.
- Głosowanie startuje na sygnał admina („Rozpocznij wybór kapitanów” - dla
  wszystkich drużyn naraz), gdy składy są gotowe. Osoba dołączona do drużyny
  w trakcie głosowania też głosuje; warunek „wszyscy zagłosowali” liczy skład
  w chwili każdego głosu.
- Uprawnieni do głosowania i kandydaci: przyjęci (`status = approved`)
  członkowie drużyny. Na siebie też można głosować.
- Nazwy, motta i kapitanowie na produkcji pochodzą z testów - migracja je
  czyści. Kolory zostają (przydzielone z góry, dobrane pod kontrast).
- Ręczne wskazanie kapitana przez admina (`WyborKapitana`) zostaje jako
  koło ratunkowe; ustawia kapitana niezależnie od stanu głosowania.

## Podejście: nazwa zawsze wypełniona

`teams.name` zawsze zawiera coś do pokazania - „Drużyna N”, dopóki kapitan
nie nada nazwy. Dzięki temu ranking, feed, sklepik, panele, eksport do arkusza
i treści powiadomień działają bez zmian. Odrzucona alternatywa: `name` pusta
i „Drużyna N” składana przy wyświetlaniu - kilkanaście miejsc do poprawy,
w tym SQL eksportu i teksty push.

## Baza

### `teams` - nowe kolumny

| kolumna | typ | znaczenie |
|---|---|---|
| `numer` | smallint unique, not null | 1-4, do „Drużyna N” i kolejności |
| `nazwa_nadana` | boolean not null default false | kapitan nadał nazwę - zablokowana |
| `glosowanie` | text not null default `'nie_rozpoczete'`, check in (`nie_rozpoczete`, `trwa`, `zakonczone`) | etap wyboru kapitana |

Migracja: `numer` wg dotychczasowej kolejności nazw, `name = 'Drużyna ' || numer`,
`motto = null`, `captain_id = null`, `nazwa_nadana = false`,
`glosowanie = 'nie_rozpoczete'`. `teams.motto` musi przyjmować NULL.

### `glosy_kapitan` (nowa)

`team_id` (fk teams), `voter_id` (fk profiles, PK - jeden głos na osobę),
`kandydat_id` (fk profiles), `created_at`, `updated_at`.
RLS: włączone; brak odczytu dla uczestników (tajność). Zapis tylko przez
funkcje. Liczbę oddanych głosów i to, czy ja głosowałem, podaje funkcja.

### Funkcje (security definer, `search_path = ''`)

- `stan_glosowania()` → dla drużyny wołającego: etap, liczba członków,
  liczba głosów, czy ja zagłosowałem i na kogo (tylko mój głos), kapitan.
- `oddaj_glos_na_kapitana(p_kandydat uuid)`:
  przyjęty uczestnik z drużyną; drużyna w etapie `trwa`; kandydat przyjęty
  i w tej samej drużynie. Upsert głosu. Blokada wiersza drużyny (`for update`)
  przeciw wyścigowi dwóch ostatnich głosów. Jeśli liczba głosów ≥ liczba
  przyjętych członków → `zamknij_glosowanie_druzyny(team)`.
- `zamknij_glosowanie_druzyny(p_team uuid)` (wewnętrzna, wołana też przez
  admina): liczy głosy, kandydaci z maksimum → losowanie (`order by random()
  limit 1`), `captain_id`, `glosowanie = 'zakonczone'`, push do drużyny
  „Kapitanem został(a) X”. Bez głosów - etap kończy się bez kapitana
  (admin wskaże ręcznie).
- `rozpocznij_glosowanie()` (admin): wszystkie drużyny `nie_rozpoczete` →
  `trwa`, push do każdej drużyny „Głosowanie na kapitana otwarte”.
- `zamknij_glosowanie_teraz(p_team uuid)` (admin): awaryjne zamknięcie.
- `nadaj_nazwe_druzyny(p_nazwa text, p_motto text)`: wołający jest kapitanem
  swojej drużyny, `nazwa_nadana = false`; nazwa 1-30 znaków po `btrim`, motto
  0-60; nazwa unikalna (bez rozróżniania wielkości liter) wśród drużyn.
  Ustawia `name`, `motto`, `nazwa_nadana = true`; push do drużyny.
- `odblokuj_nazwe(p_team uuid)` (admin): `nazwa_nadana = false`,
  `name = 'Drużyna ' || numer`, `motto = null`.

## Ekrany

### Ranking (`/app`)

- Wiersz drużyny: miejsce, nazwa, motto (jeśli jest), punkty drużyny.
- Rozwinięty skład: imiona bez punktów, kapitan oznaczony koroną.
- Karta „Twoja drużyna” nad rankingiem, zależna od etapu:
  1. `nie_rozpoczete`: skład i „Kapitana wybierzecie, gdy organizator
     otworzy głosowanie”.
  2. `trwa`: lista składu do wyboru, „Oddaj głos” (zmiana możliwa do
     zamknięcia), pasek „Zagłosowało 7 z 12”. Tajne - tylko liczby.
  3. `zakonczone`, nazwa nienadana: kapitan widzi formularz nazwy i motta
     z ostrzeżeniem „Ustawiasz raz” i podglądem; pozostali - „Kapitan (Ania)
     wymyśla nazwę”. Bez kapitana: „Kapitana wskaże organizator”.
  4. Nazwa nadana: karty nie ma.

### Panel admina „Drużyny”

- „Rozpocznij wybór kapitanów” (gdy wszystkie `nie_rozpoczete`).
- Przy drużynie: etap, postęp „7 z 12”, „Zamknij teraz” (etap `trwa`),
  „Odblokuj nazwę” (gdy `nazwa_nadana`), dotychczasowy ręczny wybór kapitana.

## Poza zakresem

- Blokada odczytu `user_scores` w bazie (punkty osób są ukryte tylko
  w interfejsie - świadoma decyzja, do dołożenia na życzenie).
- Zmiana koloru przez kapitana.

## Testy

- Baza: głos tylko w swojej drużynie i tylko w etapie `trwa`; głos na osobę
  spoza drużyny odpada; zmiana głosu; automatyczne zamknięcie po ostatnim
  głosie z ustawieniem kapitana; remis → kapitan jest jednym z remisujących;
  uczestnik nie czyta `glosy_kapitan`; nazwa tylko przez kapitana, tylko raz,
  w limitach długości, unikalna; odblokowanie przez admina przywraca
  „Drużyna N”; push przy starcie, wyborze kapitana i nadaniu nazwy.
- Telefon (emulacja, baza testowa): przejście czterech etapów karty.
