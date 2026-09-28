# Arkusz zapisów (Google Apps Script)

Skrypt `arkusz.gs` co 5 minut nadpisuje w arkuszu Google trzy zakładki pełnym
stanem zapisów z bazy: **Podsumowanie**, **Zapisy** i **Dane wrażliwe**.

> **Dostęp tylko imienny.** Zakładka „Dane wrażliwe" zawiera diety, alergie,
> choroby, leki i kontakty ICE, a Google Sheets nie ukrywa zakładek przed nikim,
> kto ma dostęp do pliku. Udostępniaj arkusz wyłącznie wskazanym organizatorom
> z nazwiska — nigdy „każdy, kto ma link". Przed pierwszym udostępnieniem IOD
> musi zatwierdzić klauzulę z Google jako podmiotem przetwarzającym
> (wersja zgód `2026-09-28.2`).

## Instalacja (raz)

1. Na koncie samorządu utwórz nowy arkusz Google, np. „JWK26 — zapisy".
2. **Rozszerzenia → Apps Script**. Usuń zawartość `Kod.gs` i wklej `arkusz.gs`.
3. **Ustawienia projektu (koło zębate) → Właściwości skryptu** — dodaj trzy:
   - `SUPABASE_URL` — adres projektu głównego, `https://tjjlslupthlylnxvfroz.supabase.co`
   - `SUPABASE_ANON_KEY` — klucz anon (ten sam co `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     w Vercelu; jest publiczny)
   - `SEKRET_ARKUSZA` — wynik zapytania w Supabase → SQL Editor na projekcie
     głównym: `select wartosc from sekrety where klucz = 'arkusz';`
4. W edytorze wybierz funkcję **`zainstaluj`** i kliknij **Uruchom**. Zatwierdź
   uprawnienia (arkusz i połączenia zewnętrzne). Zakładki pojawią się od razu,
   a potem odświeżają co 5 minut.

## Na co uważać

- **Ręczne zmiany w trzech zakładkach przepadną** przy następnym przebiegu.
  Notatki zespołu trzymajcie w osobnej zakładce — skrypt jej nie rusza.
- **Błąd pobrania zostawia poprzedni stan.** Skrypt nie czyści arkusza, gdy
  baza nie odpowie. Historia uruchomień: Apps Script → Wykonania.
- **Wyciek sekretu:** zmień go w bazie
  (`update sekrety set wartosc = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') where klucz = 'arkusz';`)
  i wklej nową wartość do właściwości skryptu.
- **Po wyjeździe** retencja w bazie kasuje dane wrażliwe (14 dni po powrocie),
  a następny przebieg skryptu usuwa je też z arkusza. Kopie pobrane z arkusza
  (CSV, wydruki) trzeba skasować ręcznie.
