# Lista przyjętych — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ekran `/app/admin/uczestnicy` z przyjętymi osobami (diety, alergie, ICE, zwolnienia, zgody) z filtrami pula/drużyna i eksportem CSV.

**Architecture:** Jedno zapytanie w `src/lib/zapisy/uczestnicy.ts` czyta przyjęte zgłoszenia z profilem, drużyną i `dane_wrazliwe` (RLS wpuszcza admina — bez migracji). Strona i trasa CSV używają tego samego zapytania i tych samych filtrów z query stringa. CSV składa czysta funkcja w `src/lib/csv.ts` (średnik, BOM, ochrona przed formułami Excela).

**Tech Stack:** Next.js 16.3.5 (App Router), Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-mapa-mechanizmow-design.md` §3 „09".

---

## Zanim zaczniesz

- **Złączenia muszą mieć wskazówki.** `registrations` ma dwa klucze do `profiles`
  (`user_id`, `reviewed_by`), a `profiles` i `teams` wskazują na siebie nawzajem
  (`team_id`, `captain_id`). Bez `!registrations_user_id_fkey`
  i `!profiles_team_id_fkey` PostgREST odrzuci zapytanie jako niejednoznaczne.
  Składnia sprawdzona na projekcie testowym 2026-09-28.
- **`dane_wrazliwe` ma klucz główny na `registration_id`**, więc PostgREST może
  zwrócić obiekt albo tablicę — kod normalizuje oba kształty.
- **CSV z danymi o zdrowiu:** nic z treści w logach, nazwa pliku stała
  (`uczestnicy-jwk26.csv`), `Cache-Control: no-store`.
- Link projektu Supabase musi wskazywać TEST (`cmuyeoobmidawmyxwihk`) przed
  uruchomieniem testów bazy.

## Pliki

| Plik | Odpowiada za |
|---|---|
| `src/lib/csv.ts` | CSV: separator `;`, BOM, CRLF, cudzysłowy, ochrona przed formułami |
| `src/lib/zapisy/uczestnicy.ts` | filtry z query stringa, zapytanie, wiersz CSV uczestnika |
| `src/app/app/admin/uczestnicy/page.tsx` | ekran z filtrami i kartami |
| `src/app/app/admin/uczestnicy/csv/route.ts` | eksport CSV, sprawdza rolę admina |
| `src/app/app/admin/page.tsx` (mod.) | wejście „Uczestnicy" |
| `tests/csv.test.ts` | CSV bez bazy |
| `tests/db/uczestnicy.test.ts` | zapytanie przeciw TEST: złączenia, filtry, RLS |

## Task 1: CSV

- [ ] Test `tests/csv.test.ts`: BOM na początku, `;` jako separator, CRLF między
  wierszami, wartość ze średnikiem/cudzysłowem/nową linią w cudzysłowach
  z podwojonym `"`, wartość zaczynająca się od `=`, `+`, `-`, `@` poprzedzona `'`,
  `null` jako pusta komórka.
- [ ] `src/lib/csv.ts`: `doCsv(naglowki: string[], wiersze: (string | null)[][]): string`.
- [ ] `npx vitest run tests/csv.test.ts` → PASS. Commit „Dodaj bezpieczny eksport CSV".

## Task 2: Zapytanie

- [ ] Test `tests/db/uczestnicy.test.ts`: przyjęta osoba z drużyną i wierszem
  `dane_wrazliwe` (klucz serwisowy) → admin widzi ją z nazwą drużyny, dietą i ICE;
  filtr puli i drużyny zawęża; zwykły uczestnik dostaje pustą listę; zgłoszenie
  oczekujące nie trafia na listę.
- [ ] `src/lib/zapisy/uczestnicy.ts`: `parsujFiltry`, `wczytajUczestnikow`,
  `wierszCsv`, `NAGLOWKI_CSV`.
- [ ] `npx vitest run tests/db/uczestnicy.test.ts` → PASS. Commit „Dodaj zapytanie listy przyjętych".

## Task 3: Ekran i CSV

- [ ] `page.tsx`: formularz GET z filtrami (bez JS), liczba osób, karty (osoba,
  ksywka, pula, drużyna, telefon, dojazd, zwolnienie, alkohol, znacznik braku zgody
  na wizerunek; dieta, alergie, choroby i leki, ICE pod `<details>`), link do CSV
  z tymi samymi filtrami i ostrzeżeniem.
- [ ] `csv/route.ts`: `GET`, 401 bez sesji, 403 bez roli admina, CSV z nagłówkami
  `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`,
  `Cache-Control: no-store`.
- [ ] Wejście w `WEJSCIA` panelu.
- [ ] `npx tsc --noEmit && npx eslint && npm run build` → czysto, `/app/admin/uczestnicy`
  i `/app/admin/uczestnicy/csv` na liście tras. Commit „Dodaj listę przyjętych z eksportem CSV".
