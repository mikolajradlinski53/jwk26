# Arkusz Google — plan implementacji

**Goal:** Arkusz Google zespołu z pełnym stanem zapisów, odświeżany co 5 minut.

**Architecture:** Funkcja `eksport_arkusza(sekret)` (prawami właściciela, rola anon)
zwraca gotowe tabele `{ naglowki, wiersze }` z polskimi etykietami: podsumowanie
pul, wszystkie zgłoszenia, dane wrażliwe osobno. Sekret w tabeli `sekrety` bez
grantów. Skrypt GAS (`gas/arkusz.gs`) co 5 minut nadpisuje trzy zakładki,
rozbrajając wartości, które Sheets wykonałby jako formuły.

**Spec:** `docs/superpowers/specs/2026-09-28-mapa-mechanizmow-design.md` §3 „10".

## Task 1: Eksport w bazie — zrobione

- `supabase/migrations/20260928140000_eksport_arkusza.sql`
- `tests/db/arkusz.test.ts`: zły sekret odbity, zalogowany uczestnik odbity nawet
  z sekretem, etykiety (status, pula, dojazd, rezerwa z pozycją), dane o zdrowiu
  tylko w zakładce wrażliwej, podsumowanie w kolejności pul.

## Task 2: Skrypt i instrukcja — zrobione

- `gas/arkusz.gs`, `gas/README.md` (instalacja, dostęp imienny, rotacja sekretu).

## Task 3: Klauzula — zrobione

- `src/lib/zapisy/zgody.ts`: Google jako podmiot przetwarzający; `WERSJA_ZGOD`
  `2026-09-28.2`. Arkusz udostępniany wyłącznie imiennie.

## Task 4: Wdrożenie

- Migracja na produkcję, potem instalacja skryptu wg `gas/README.md`.
