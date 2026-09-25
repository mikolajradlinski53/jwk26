-- ============================================================
-- Sekta Wyjazdowa — widok czynnych efektów
-- ============================================================
--
-- „Czynny" znaczy: niezużyty i nieprzedawniony. Warunek mieszka tutaj, a nie
-- w komponencie, z dwóch powodów.
--
-- Pierwszy jest rzeczowy: `expires_at` bywa NULL (tarcza trwa, aż ją coś zużyje),
-- więc filtr trzeba pisać jako alternatywę, a taka alternatywa zapisana przez
-- PostgREST czyta się znacznie gorzej niż zdanie SQL.
--
-- Drugi jest twardy: reguła `react-hooks/purity` w tej wersji Nexta odrzuca
-- `Date.now()` wywołane w trakcie renderu, także w komponencie serwerowym.
-- Odsianie przedawnionych po stronie JavaScriptu wymagałoby więc wyciszenia
-- reguły — a to samo zdanie wykonane w bazie jest i krótsze, i prawdziwsze,
-- bo `now()` liczy się po stronie tego zegara, który zapisywał `expires_at`.
--
-- security_invoker = on, jak pozostałe widoki: bez tego widok czytałby tabelę
-- prawami właściciela i obszedłby RLS.
create view czynne_efekty with (security_invoker = on) as
  select id, scope, subject_id, effect_key, effect_value,
         expires_at, consumed_at, order_id, created_at
  from active_effects
  where consumed_at is null
    and (expires_at is null or expires_at > now());
