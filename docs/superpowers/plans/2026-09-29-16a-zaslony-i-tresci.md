# Plan 16a · Zasłony i treści landingu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zakryć na landingu ośrodek, cenę i zapisy do dat z Ustawień (treść nie wychodzi z bazy przed czasem) i uporządkować treści według wariantu B ze specu `docs/superpowers/specs/2026-09-29-landing-finalizacja-design.md` (sekcje 1 i 2).

**Architecture:** Decyzję „odsłonięte / zakryte” podejmuje baza (`odsloniete()`), a polityki RLS na `app_settings` same odcinają miejsce i dane przelewu przed czasem — landing dostaje pustkę, zanim cokolwiek wyrenderuje. Strona serwerowa czyta stan odsłon jednym RPC (`odslony()`), zakryte sekcje renderuje jako rozmytą atrapę z licznikiem; klientowy licznik na zerze woła `router.refresh()`. Treści (tury, FAQ, plan z harmonogramu, dokumenty, stopka) to przebudowa istniejących komponentów w `src/app/landing/`.

**Tech Stack:** Next.js 16 (App Router, `generateMetadata`, plikowy `opengraph-image`), React 19, Tailwind 4 (klasy `jesien-*`), Supabase (plpgsql, RLS), Vitest (baza testowa `cmuyeoobmidawmyxwihk`), sharp (skrypt obrazka podglądu), Playwright-core ze scratchpada (przegląd wizualny).

**Zasady projektu obowiązujące w każdym tasku:**
- Komentarze i nazwy po polsku, gęstość komentarzy jak w otaczającym kodzie.
- `react-hooks/set-state-in-effect` i `react-hooks/purity` są twardymi błędami: żadnego `setState` w ciele efektu, żadnego `Date.now()` w renderze (dozwolone `new Date()`).
- Nowa migracja = nowy plik; `db push` nie uruchamia zastosowanej ponownie. CLI jest podlinkowane do bazy **testowej**.
- Landing nie może zdradzić motywu sekty ani (przed odsłoną) miasta, nazwy ośrodka i ceny.

---

## Mapa plików

| Plik | Rola |
|---|---|
| `supabase/migrations/20260929200000_odslony.sql` | klucze odsłon i social, `data_odslony`, `odsloniete`, `odslony`, `ustawienie_jawne`, nowe polityki odczytu `app_settings`, walidacja adresów social |
| `supabase/migrations/20260929200100_harmonogram_landing.sql` | `harmonogram.na_landingu`, odczyt dla `anon`, szkic planu |
| `src/lib/odslony.ts` | typy odsłon, lustro reguły w TS, odczyt RPC, teksty licznika, `miastoZAdresu`, `DATY_WYJAZDU` |
| `src/lib/ustawienia.ts` | + `social()` |
| `src/lib/regulamin.ts` | + `regulaminDoWyswietlenia()` (maskowanie § 1 ust. 3) |
| `src/app/landing/LicznikOdslony.tsx` | klientowy licznik tekstowy, `router.refresh()` na zerze |
| `src/app/landing/Zaslona.tsx` | sekcja zakryta: nagłówek, atrapa, licznik |
| `src/app/landing/PrzyciskZapisu.tsx` | „Zapisz się” albo licznik nad wyszarzonym przyciskiem (3 warianty) |
| `src/app/landing/Plan.tsx` | nowa sekcja 02 z punktów harmonogramu |
| `src/app/landing/Zapisy.tsx` | nowa sekcja 04 (zastępuje `JakSieZapisac.tsx`) |
| `src/app/landing/Dokumenty.tsx` | nowa sekcja 09 |
| `src/app/landing/{Wejscie,Opis,KiedyGdzie,Mapa,CenaIWplata,CoZabrac,Pytania,Promocja,Galeria,Stopka,PanelWezwania}.tsx` | przebudowa według specu |
| `src/app/page.tsx` | nowa kolejność, odczyty, `generateMetadata` |
| `src/app/regulamin/page.tsx` | maskowanie miejsca przed odsłoną |
| `src/app/app/admin/ustawienia/{page,Formularz,FormularzOdslon}.tsx` | daty odsłon, adresy social, neutralne placeholdery |
| `src/app/app/admin/harmonogram/{page,Edytor}.tsx`, `src/lib/harmonogram.ts` | przełącznik „Pokaż na landingu” |
| `public/hero/o-4c8e1a.jpg`, `public/hero/o-9b2d7f.jpg` | zdjęcia ośrodka pod losowymi nazwami |
| `scripts/grafika/og.mjs`, `src/app/opengraph-image.jpg`, `src/app/opengraph-image.alt.txt` | obrazek podglądu linku |
| `scripts/sprawdz-przeciek.mjs` | kontrola przecieku w HTML-u i skryptach landingu |
| `tests/odslony.test.ts` | testy czystych funkcji |
| `tests/db/odslony.test.ts` | testy RLS i RPC odsłon, walidacja social |
| `tests/db/harmonogram.test.ts` | aktualizacja: `anon` widzi tylko `na_landingu` |

---

### Task 1: Odsłony w bazie

**Files:**
- Create: `supabase/migrations/20260929200000_odslony.sql`
- Test: `tests/db/odslony.test.ts`

- [ ] **Step 1: Napisz test (nie przejdzie — funkcji i kluczy nie ma)**

```ts
// tests/db/odslony.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  anonimowy,
  signIn,
  ustawUstawienie,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();

const PRZYSZLOSC = "2099-01-01T12:00:00+01:00";
const PRZESZLOSC = "2020-01-01T12:00:00+01:00";
const DOMYSLNE = {
  odslona_osrodek: "2026-10-05T18:00:00+02:00",
  odslona_cena: "2026-10-08T18:00:00+02:00",
  odslona_zapisy: "2026-10-12T18:00:00+02:00",
};

let uczestnik: SupabaseClient;
let szef: SupabaseClient;
let poprzedniaKwota: unknown = null;

async function odslony(osrodek: string, cena: string, zapisy: string) {
  await ustawUstawienie("odslona_osrodek", osrodek);
  await ustawUstawienie("odslona_cena", cena);
  await ustawUstawienie("odslona_zapisy", zapisy);
}

async function widzi(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client
    .from("app_settings")
    .select("key")
    .in("key", ["miejsce_nazwa", "miejsce_adres", "przelew_kwota", "data_jwk", "odslona_osrodek", "social_instagram"]);
  if (error) throw error;
  return new Set((data ?? []).map((w) => w.key as string));
}

beforeAll(async () => {
  const { data } = await admin.from("app_settings").select("value").eq("key", "przelew_kwota").maybeSingle();
  poprzedniaKwota = data?.value ?? null;
  // Klucz musi istnieć — inaczej „nie widzi” przechodziłoby na pustej tabeli.
  await ustawUstawienie("przelew_kwota", 320);

  const u = await nowyUzytkownik("odslony-uczestnik");
  await ustawJakoZaakceptowany(u);
  const a = await nowyAdmin("odslony-szef");
  uczestnik = await signIn(u);
  szef = await signIn(a);
});

afterAll(async () => {
  for (const [k, v] of Object.entries(DOMYSLNE)) await ustawUstawienie(k, v);
  if (poprzedniaKwota === null) await admin.from("app_settings").delete().eq("key", "przelew_kwota");
  else await ustawUstawienie("przelew_kwota", poprzedniaKwota);
  await ustawUstawienie("social_instagram", "");
  await posprzataj();
});

describe("zasłony w bazie", () => {
  it("przed datami niezalogowany nie czyta miejsca ani kwoty, ale czyta daty odsłon", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZYSZLOSC);
    const w = await widzi(anonimowy());
    expect(w.has("miejsce_nazwa")).toBe(false);
    expect(w.has("miejsce_adres")).toBe(false);
    expect(w.has("przelew_kwota")).toBe(false);
    expect(w.has("data_jwk")).toBe(true);
    expect(w.has("odslona_osrodek")).toBe(true);
    expect(w.has("social_instagram")).toBe(true);
  });

  it("po dacie ośrodka widać miejsce, kwota dalej zakryta", async () => {
    await odslony(PRZESZLOSC, PRZYSZLOSC, PRZYSZLOSC);
    const w = await widzi(anonimowy());
    expect(w.has("miejsce_nazwa")).toBe(true);
    expect(w.has("przelew_kwota")).toBe(false);
  });

  it("odsłona zapisów odsłania wszystko", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZESZLOSC);
    const w = await widzi(anonimowy());
    expect(w.has("miejsce_nazwa")).toBe(true);
    expect(w.has("przelew_kwota")).toBe(true);
  });

  it("zalogowany uczestnik jak niezalogowany; admin widzi zawsze", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZYSZLOSC);
    expect((await widzi(uczestnik)).has("miejsce_nazwa")).toBe(false);
    const s = await widzi(szef);
    expect(s.has("miejsce_nazwa")).toBe(true);
    expect(s.has("przelew_kwota")).toBe(true);
  });

  it("odslony() podaje stan i daty; pusta data znaczy odsłonięte", async () => {
    await odslony("", PRZYSZLOSC, PRZYSZLOSC);
    const { data, error } = await anonimowy().rpc("odslony");
    expect(error).toBeNull();
    const o = data as Record<string, { data: string | null; odsloniete: boolean }>;
    expect(o.osrodek).toEqual({ data: null, odsloniete: true });
    expect(o.cena.odsloniete).toBe(false);
    expect(new Date(o.cena.data!).getTime()).toBe(new Date(PRZYSZLOSC).getTime());
  });

  it("adres social tylko z właściwej domeny albo pusty", async () => {
    await expect(ustawUstawienie("social_instagram", "https://evil.example/jwk")).rejects.toBeTruthy();
    await expect(ustawUstawienie("social_instagram", "https://www.facebook.com/jwk")).rejects.toBeTruthy();
    await ustawUstawienie("social_instagram", "https://www.instagram.com/jwk26/");
    await ustawUstawienie("social_instagram", "");
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/db/odslony.test.ts`
Expected: FAIL (`odslony` nie istnieje, klucze niewidoczne / widoczne nie tak, jak test zakłada).

- [ ] **Step 3: Napisz migrację**

```sql
-- supabase/migrations/20260929200000_odslony.sql
-- ============================================================
-- Sekta Wyjazdowa — landing: zasłony (plan 16a)
-- ============================================================
--
-- Spec 2026-09-29-landing-finalizacja-design.md, sekcja 1. Ośrodek, cena
-- i zapisy odsłaniają się każde o swojej dacie; odsłona zapisów odsłania
-- wszystko. Decyduje baza, nie strona: polityki odczytu same odcinają
-- miejsce i dane przelewu, więc przed czasem nie da się ich wyciągnąć ani
-- z landingu, ani wprost przez API kluczem anon.

insert into app_settings (key, value) values
  ('odslona_osrodek',  '"2026-10-05T18:00:00+02:00"'::jsonb),
  ('odslona_cena',     '"2026-10-08T18:00:00+02:00"'::jsonb),
  ('odslona_zapisy',   '"2026-10-12T18:00:00+02:00"'::jsonb),
  ('social_instagram', '""'::jsonb),
  ('social_facebook',  '""'::jsonb)
on conflict (key) do nothing;

-- Pusta wartość = brak daty.
create function public.data_odslony(p_co text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(value #>> '{}', '')::timestamptz
  from public.app_settings where key = 'odslona_' || p_co;
$$;

-- Pusta data = odsłonięte (bezpieczne dla nowej bazy). Zapisy bez daty albo
-- po dacie odsłaniają wszystko — nikt nie akceptuje regulaminu z ukrytym
-- miejscem ani nie płaci bez widocznej ceny.
create function public.odsloniete(p_co text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_wlasna timestamptz;
  v_zapisy timestamptz;
begin
  if p_co not in ('osrodek', 'cena', 'zapisy') then
    raise exception 'Nieznana odslona: %', p_co;
  end if;
  v_wlasna := public.data_odslony(p_co);
  v_zapisy := public.data_odslony('zapisy');
  return v_wlasna is null or now() >= v_wlasna
      or v_zapisy is null or now() >= v_zapisy;
end;
$$;

-- Jeden odczyt dla strony: stan i data każdej odsłony.
create function public.odslony()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_object_agg(co, jsonb_build_object(
    'data', public.data_odslony(co),
    'odsloniete', public.odsloniete(co)
  ))
  from unnest(array['osrodek', 'cena', 'zapisy']) as co;
$$;

-- Czy klucz ustawień wolno dziś pokazać komuś, kto nie jest adminem.
create function public.ustawienie_jawne(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_key in ('miejsce_nazwa', 'miejsce_adres') then public.odsloniete('osrodek')
    when p_key in ('przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota') then public.odsloniete('cena')
    else true
  end;
$$;

revoke execute on function public.data_odslony(text) from public;
revoke execute on function public.odsloniete(text) from public;
revoke execute on function public.odslony() from public;
revoke execute on function public.ustawienie_jawne(text) from public;
grant execute on function public.data_odslony(text) to anon, authenticated;
grant execute on function public.odsloniete(text) to anon, authenticated;
grant execute on function public.odslony() to anon, authenticated;
grant execute on function public.ustawienie_jawne(text) to anon, authenticated;

-- ---------- Odczyt ustawień ----------
drop policy if exists settings_read_public on app_settings;
create policy settings_read_public on app_settings
  for select to anon
  using (
    key in ('data_jwk', 'data_swiezakow', 'miejsce_nazwa', 'miejsce_adres',
            'regulamin_zatwierdzony',
            'przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota',
            'odslona_osrodek', 'odslona_cena', 'odslona_zapisy',
            'social_instagram', 'social_facebook')
    and public.ustawienie_jawne(key)
  );

-- Zalogowany nie-admin czyta jak dotąd wszystko, poza zakrytymi kluczami.
drop policy if exists settings_read on app_settings;
create policy settings_read on app_settings
  for select to authenticated
  using (public.is_admin() or public.ustawienie_jawne(key));

-- ---------- Adresy social ----------
-- Pusty albo profil w swoim serwisie — link z landingu nie wyprowadzi
-- nikogo na obcą stronę, nawet po literówce w panelu.
alter table app_settings
  add constraint app_settings_social_check check (
    (key <> 'social_instagram'
      or coalesce(value #>> '{}', '') = ''
      or (value #>> '{}') ~ '^https://www\.instagram\.com/[A-Za-z0-9._/?=&-]+$')
    and
    (key <> 'social_facebook'
      or coalesce(value #>> '{}', '') = ''
      or (value #>> '{}') ~ '^https://www\.facebook\.com/[A-Za-z0-9._/?=&-]+$')
  );
```

- [ ] **Step 4: Zastosuj na bazie testowej i uruchom test**

Run: `npx supabase db push --yes` → `Applying migration 20260929200000_odslony.sql...`
Run: `npx vitest run tests/db/odslony.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: Regresja ustawień i zapisów**

Run: `npx vitest run tests/db/zapisy.test.ts tests/db/admini-formularz.test.ts`
Expected: PASS. (Zapisy testują formularz na koncie uczestnika; kwota przelewu jest mu potrzebna tylko po odsłonie — testy formularza nie czytają `app_settings` jako uczestnik. Jeśli któryś padnie na braku danych przelewu, ustaw w nim `odslona_zapisy` na przeszłość w `beforeAll`.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260929200000_odslony.sql tests/db/odslony.test.ts
git commit -m "Zakryj miejsce i cenę w bazie do dat odsłon z ustawień"
```

---

### Task 2: Plan z harmonogramu w bazie

**Files:**
- Create: `supabase/migrations/20260929200100_harmonogram_landing.sql`
- Modify: `tests/db/harmonogram.test.ts`

- [ ] **Step 1: Zmień test anonima w `tests/db/harmonogram.test.ts`**

Zastąp test „czekający na akceptację i niezalogowany nie widzą programu” dwoma:

```ts
  it("czekający na akceptację nie widzi programu", async () => {
    await dodaj(szef);
    expect((await czekajacy.from("harmonogram").select("id").like("tytul", "%(test)")).data).toEqual([]);
  });

  it("niezalogowany widzi wyłącznie punkty oznaczone na landing", async () => {
    const { data: ukryty } = await dodaj(szef);
    const { data: jawny } = await szef
      .from("harmonogram")
      .insert({ dzien: "2026-10-24", godzina: "10:00", tytul: "Jawny punkt (test)", na_landingu: true })
      .select("id")
      .single();

    const { data, error } = await anonimowy().from("harmonogram").select("id, tytul").like("tytul", "%(test)");
    expect(error).toBeNull();
    const id = (data ?? []).map((w) => w.id);
    expect(id).toContain(jawny!.id);
    expect(id).not.toContain(ukryty!.id);
  });
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/db/harmonogram.test.ts`
Expected: FAIL (kolumny `na_landingu` nie ma; anon dostaje błąd uprawnień).

- [ ] **Step 3: Migracja**

```sql
-- supabase/migrations/20260929200100_harmonogram_landing.sql
-- ============================================================
-- Sekta Wyjazdowa — landing: plan z harmonogramu (plan 16a)
-- ============================================================
--
-- Plan żyje w jednym miejscu. Landing pokazuje wyłącznie punkty, które admin
-- oznaczył „na landing” — reszta (w tym wszystko z motywem) zostaje w apce.

alter table harmonogram add column na_landingu boolean not null default false;

grant select (id, dzien, godzina, tytul, opis, na_landingu) on harmonogram to anon;

create policy harmonogram_read_public on harmonogram
  for select to anon
  using (na_landingu);

-- Szkic do podmiany przez właściciela po konsultacji z Zespołem. Tylko gdy
-- na landing nie ma jeszcze nic — ponowne zastosowanie nie zdubluje planu.
insert into harmonogram (dzien, godzina, tytul, opis, na_landingu)
select v.dzien::date, v.godzina::time, v.tytul, v.opis, true
from (values
  ('2026-10-23', '16:00', 'Zbiórka i wyjazd',         'Wyjeżdżamy autokarem spod uczelni. (szkic)'),
  ('2026-10-23', '19:00', 'Zakwaterowanie i kolacja', 'Rozlokowanie w pokojach, potem wspólna kolacja. (szkic)'),
  ('2026-10-23', '21:00', 'Wieczór integracyjny',     'Poznajemy się w drużynach. (szkic)'),
  ('2026-10-24', '09:00', 'Śniadanie',                null),
  ('2026-10-24', '10:00', 'Szkolenia w komisjach',    'Praca w komisjach i warsztaty. (szkic)'),
  ('2026-10-24', '13:30', 'Obiad',                    null),
  ('2026-10-24', '15:00', 'Gra terenowa',             'Rywalizacja drużyn w terenie — ubierz się ciepło. (szkic)'),
  ('2026-10-24', '21:00', 'Wieczór główny',           'Najważniejszy wieczór wyjazdu. (szkic)'),
  ('2026-10-25', '09:30', 'Śniadanie',                null),
  ('2026-10-25', '11:00', 'Podsumowanie wyjazdu',     'Wyniki drużyn i zdjęcie grupowe. (szkic)'),
  ('2026-10-25', '13:00', 'Powrót',                   'Wykwaterowanie i powrót autokarem. (szkic)')
) as v(dzien, godzina, tytul, opis)
where not exists (select 1 from harmonogram where na_landingu);
```

- [ ] **Step 4: Zastosuj i uruchom test**

Run: `npx supabase db push --yes`
Run: `npx vitest run tests/db/harmonogram.test.ts`
Expected: PASS (5 testów).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929200100_harmonogram_landing.sql tests/db/harmonogram.test.ts
git commit -m "Pokaż na landingu wybrane punkty harmonogramu i wgraj szkic planu"
```

---

### Task 3: Odsłony w TypeScripcie

**Files:**
- Create: `src/lib/odslony.ts`
- Modify: `src/lib/ustawienia.ts`
- Test: `tests/odslony.test.ts`

- [ ] **Step 1: Test czystych funkcji**

```ts
// tests/odslony.test.ts
import { describe, it, expect } from "vitest";
import { czyOdsloniete, miastoZAdresu, kiedyOdslona, tekstOdliczania } from "../src/lib/odslony";

const P = "2099-01-01T12:00:00+01:00";
const W = "2020-01-01T12:00:00+01:00";
const teraz = new Date("2026-10-01T12:00:00+02:00");

describe("czyOdsloniete — lustro reguły z bazy", () => {
  it("własna data decyduje, gdy zapisy przed nami", () => {
    expect(czyOdsloniete({ osrodek: W, cena: P, zapisy: P }, "osrodek", teraz)).toBe(true);
    expect(czyOdsloniete({ osrodek: W, cena: P, zapisy: P }, "cena", teraz)).toBe(false);
  });
  it("odsłona zapisów odsłania wszystko", () => {
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: W }, "cena", teraz)).toBe(true);
  });
  it("pusta data znaczy odsłonięte", () => {
    expect(czyOdsloniete({ osrodek: null, cena: P, zapisy: P }, "osrodek", teraz)).toBe(true);
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: null }, "osrodek", teraz)).toBe(true);
  });
});

describe("teksty", () => {
  it("miasto z adresu po kodzie pocztowym", () => {
    expect(miastoZAdresu("Poznańska 5, 58-540 Karpacz")).toBe("Karpacz");
    expect(miastoZAdresu("ul. Długa 1, 00-001 Nowa Wieś")).toBe("Nowa Wieś");
    expect(miastoZAdresu(null)).toBeNull();
    expect(miastoZAdresu("bez kodu")).toBeNull();
  });
  it("kiedy odsłona — po polsku, w strefie warszawskiej", () => {
    expect(kiedyOdslona("2026-10-05T16:00:00+00:00")).toBe("5 października o 18:00");
    expect(kiedyOdslona(null)).toBe("wkrótce");
  });
  it("odliczanie w skrócie", () => {
    expect(tekstOdliczania({ minelo: false, dni: 3, godziny: 4, minuty: 5, sekundy: 6 })).toBe("3 d 04:05:06");
    expect(tekstOdliczania({ minelo: true, dni: 0, godziny: 0, minuty: 0, sekundy: 0 })).toBe("za chwilę");
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/odslony.test.ts`
Expected: FAIL (brak modułu `src/lib/odslony`).

- [ ] **Step 3: Implementacja**

```ts
// src/lib/odslony.ts
import type { createClient } from "@/lib/supabase/server";
import { odliczanie, type Odliczanie } from "@/lib/odliczanie";

type Klient = Awaited<ReturnType<typeof createClient>>;

export type Co = "osrodek" | "cena" | "zapisy";
export type Odslona = { data: string | null; odsloniete: boolean };
export type Odslony = Record<Co, Odslona>;

/** Odsłona z tekstami policzonymi na serwerze — pierwsza klatka bez skoku. */
export type OdslonaWidok = Odslona & { poczatkowy: string; kiedy: string };
export type OdslonyWidok = Record<Co, OdslonaWidok>;

/** Daty wyjazdu jak w regulaminie (§ 1 ust. 3) — jawne od początku. */
export const DATY_WYJAZDU = "23–25 października";

const CO: Co[] = ["osrodek", "cena", "zapisy"];

/**
 * Awaria odczytu = wszystko zakryte. Bezpieczniej pokazać zasłonę za długo,
 * niż odsłonić za wcześnie; i tak baza nie wyda zakrytych danych.
 */
export const WSZYSTKO_ZAKRYTE: Odslony = {
  osrodek: { data: null, odsloniete: false },
  cena: { data: null, odsloniete: false },
  zapisy: { data: null, odsloniete: false },
};

/**
 * Lustro `public.odsloniete()` — wyłącznie dla liczników po stronie klienta.
 * Decyzję, co wysłać, zawsze podejmuje baza.
 */
export function czyOdsloniete(daty: Record<Co, string | null>, co: Co, teraz: Date): boolean {
  const minela = (d: string | null) => d === null || d === "" || teraz.getTime() >= new Date(d).getTime();
  return minela(daty[co]) || minela(daty.zapisy);
}

export async function wczytajOdslony(supabase: Klient): Promise<Odslony> {
  const { data, error } = await supabase.rpc("odslony");
  if (error || !data) {
    console.error("Nie udało się wczytać odsłon:", error ? { code: error.code, message: error.message } : "brak danych");
    return WSZYSTKO_ZAKRYTE;
  }
  const surowe = data as Partial<Record<Co, Odslona>>;
  return Object.fromEntries(
    CO.map((c) => [c, surowe[c] ?? WSZYSTKO_ZAKRYTE[c]]),
  ) as Odslony;
}

const KIEDY = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** „5 października o 18:00” — dla czytnika ekranu i podpisów. */
export function kiedyOdslona(data: string | null): string {
  if (!data) return "wkrótce";
  const czesci = KIEDY.formatToParts(new Date(data));
  const pole = (t: Intl.DateTimeFormatPartTypes) => czesci.find((c) => c.type === t)?.value ?? "";
  return `${pole("day")} ${pole("month")} o ${pole("hour")}:${pole("minute")}`;
}

/** „3 d 04:05:06”; po terminie „za chwilę” (serwer zaraz odsłoni sekcję). */
export function tekstOdliczania(o: Odliczanie): string {
  if (o.minelo) return "za chwilę";
  const dwa = (n: number) => String(n).padStart(2, "0");
  return `${o.dni} d ${dwa(o.godziny)}:${dwa(o.minuty)}:${dwa(o.sekundy)}`;
}

export function widokOdslon(odslony: Odslony, teraz: Date): OdslonyWidok {
  return Object.fromEntries(
    CO.map((c) => {
      const o = odslony[c];
      const poczatkowy = o.data ? tekstOdliczania(odliczanie(o.data, teraz)) : "wkrótce";
      return [c, { ...o, poczatkowy, kiedy: kiedyOdslona(o.data) }];
    }),
  ) as OdslonyWidok;
}

/**
 * Miasto z adresu z panelu („Poznańska 5, 58-540 Karpacz” → „Karpacz”).
 * Nazwa miasta nie siedzi nigdzie w kodzie — przed odsłoną baza nie wyda
 * adresu, więc nie ma skąd jej wziąć.
 */
export function miastoZAdresu(adres: string | null): string | null {
  const m = adres?.match(/\d{2}-\d{3}\s+(.+)$/);
  return m ? m[1].trim() : null;
}
```

Dopisz do `src/lib/ustawienia.ts` (na końcu pliku):

```ts
export type Social = { instagram: string | null; facebook: string | null };

/** Adresy profili z panelu. Pusty = brak ikony. Awaria = brak ikon. */
export async function social(): Promise<Social> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["social_instagram", "social_facebook"]);
  if (error) console.error("Nie udało się wczytać adresów social:", error);
  const mapa = new Map((data ?? []).map((w) => [w.key as string, String(w.value ?? "")]));
  return {
    instagram: mapa.get("social_instagram") || null,
    facebook: mapa.get("social_facebook") || null,
  };
}
```

- [ ] **Step 4: Uruchom test**

Run: `npx vitest run tests/odslony.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/odslony.ts src/lib/ustawienia.ts tests/odslony.test.ts
git commit -m "Dodaj odczyt odsłon, teksty liczników i miasto z adresu"
```

---

### Task 4: Licznik odsłony, zasłona i przycisk zapisu

**Files:**
- Create: `src/app/landing/LicznikOdslony.tsx`, `src/app/landing/Zaslona.tsx`, `src/app/landing/PrzyciskZapisu.tsx`

- [ ] **Step 1: `LicznikOdslony.tsx`**

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { odliczanie } from "@/lib/odliczanie";
import { tekstOdliczania } from "@/lib/odslony";

function subskrybuj(powiadom: () => void) {
  const id = setInterval(powiadom, 1000);
  return () => clearInterval(id);
}
function terazMs() {
  return Date.now();
}
function terazNaSerwerze() {
  return null;
}

/**
 * Licznik do odsłony jako jedna linia tekstu. Pierwsza klatka to `poczatkowy`
 * z serwera (jak w `Licznik`). Na zerze prosi serwer o nową wersję strony —
 * bez przeładowania. Ponawia co 5 s, najwyżej sześć razy, bo zegar telefonu
 * bywa o kilka sekund przed zegarem bazy, a to baza decyduje o odsłonie.
 * Po odsłonie serwer przysyła sekcję bez licznika, więc komponent znika
 * razem ze swoim interwałem.
 */
export function LicznikOdslony({
  data,
  poczatkowy,
  className = "",
}: {
  data: string | null;
  poczatkowy: string;
  className?: string;
}) {
  const router = useRouter();
  const teraz = useSyncExternalStore(subskrybuj, terazMs, terazNaSerwerze);
  const w = teraz === null || !data ? null : odliczanie(data, new Date(teraz));
  const minelo = w?.minelo ?? false;

  useEffect(() => {
    if (!minelo) return;
    router.refresh();
    let proby = 1;
    const id = setInterval(() => {
      router.refresh();
      proby += 1;
      if (proby >= 6) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [minelo, router]);

  return (
    <span aria-hidden="true" className={`font-tytul tabular-nums ${className}`}>
      {w === null ? poczatkowy : tekstOdliczania(w)}
    </span>
  );
}
```

- [ ] **Step 2: `Zaslona.tsx`**

```tsx
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { LicznikOdslony } from "./LicznikOdslony";
import type { OdslonaWidok } from "@/lib/odslony";

/**
 * Rozmyte kształty udające treść. Nie powstają z prawdziwej treści — to
 * stały rysunek, więc nic nie da się z niego odczytać.
 */
function Atrapa({ ksztalt }: { ksztalt: "osrodek" | "cena" }) {
  if (ksztalt === "osrodek") {
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-[1.7fr_1fr] gap-2.5">
          <div className="aspect-[4/3] rounded-lg bg-jesien-kora/20" />
          <div className="aspect-[4/3] rounded-lg bg-jesien-mech/25" />
        </div>
        <div className="grid gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
          <div className="h-3.5 w-2/5 rounded-full bg-jesien-atrament/25" />
          <div className="h-3 w-3/5 rounded-full bg-jesien-rdza/25" />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="h-14 w-40 rounded-md bg-jesien-rdza/30" />
      <div className="h-3 w-3/5 rounded-full bg-jesien-atrament/25" />
      <div className="h-3 w-4/5 rounded-full bg-jesien-kora/20" />
      <div className="mt-3 h-36 rounded-lg border-2 border-dashed border-jesien-dynia/50 bg-jesien-tlo/60" />
    </div>
  );
}

/**
 * Sekcja pod zasłoną: nagłówek widoczny, pod nim atrapa i licznik. Czytnik
 * ekranu słyszy datę odsłony, nie tykające cyfry.
 */
export function Zaslona({
  id,
  numer,
  nadtytul,
  tytul,
  tlo,
  ksztalt,
  odslona,
  children,
}: {
  id: string;
  numer: string;
  nadtytul: string;
  tytul: string;
  /** Klasa tła sekcji, ta sama co w odsłoniętej wersji — rytm strony się nie zmienia. */
  tlo: string;
  ksztalt: "osrodek" | "cena";
  odslona: OdslonaWidok;
  /** Treść jawna przed odsłoną, nad atrapą (np. daty w „Kiedy i gdzie”). */
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className={`${tlo} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer={numer} nadtytul={nadtytul} tytul={tytul} />
        {children}
        <div className="relative mt-4">
          <div aria-hidden="true" className="pointer-events-none select-none blur-[6px]">
            <Atrapa ksztalt={ksztalt} />
          </div>
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="grid justify-items-center gap-1 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/90 px-6 py-4 text-center shadow-[0_14px_30px_-18px_rgb(47_33_24/0.5)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Odsłonimy za</p>
              <LicznikOdslony data={odslona.data} poczatkowy={odslona.poczatkowy} className="text-3xl text-jesien-atrament" />
              <p className="sr-only">Odsłonimy {odslona.kiedy}.</p>
            </div>
          </div>
        </div>
      </Kontener>
    </section>
  );
}
```

- [ ] **Step 3: `PrzyciskZapisu.tsx`**

```tsx
import Link from "next/link";
import { LicznikOdslony } from "./LicznikOdslony";
import type { OdslonaWidok } from "@/lib/odslony";

const STYLE = {
  // Na zdjęciu hero — biały tekst nad przyciemnieniem.
  hero: {
    przycisk:
      "flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full border border-jesien-rdza/40 " +
      "bg-jesien-rdza px-5 text-sm font-bold text-white shadow-[0_14px_30px_-12px_rgb(12_7_9/0.6)] transition " +
      "hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
    podpis: "text-sm text-white drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)]",
  },
  // Jasna sekcja landingu.
  sekcja: {
    przycisk:
      "flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full bg-jesien-rdza px-5 text-sm " +
      "font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 " +
      "focus-visible:outline-jesien-rdza",
    podpis: "text-sm text-jesien-atrament",
  },
  // Panel wezwania w stopce — biały prostokąt na gradiencie.
  panel: {
    przycisk:
      "flex h-[42px] min-w-[120px] items-center justify-center rounded-sm bg-white px-6 text-[12px] font-semibold " +
      "text-jesien-atrament focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
    podpis: "text-[13px] text-white",
  },
} as const;

/**
 * „Zapisz się” po odsłonie zapisów; przedtem licznik nad wyszarzonym
 * przyciskiem, który nigdzie nie prowadzi. „Wejdź” w nagłówku zostaje
 * aktywne zawsze — to droga dla kont, które już istnieją.
 */
export function PrzyciskZapisu({ odslona, wariant }: { odslona: OdslonaWidok; wariant: keyof typeof STYLE }) {
  const s = STYLE[wariant];
  if (odslona.odsloniete) {
    return (
      <Link href="/wejscie" className={s.przycisk}>
        Zapisz się
      </Link>
    );
  }
  return (
    <div className="grid justify-items-center gap-2">
      <p className={s.podpis}>
        Zapisy ruszają za{" "}
        <LicznikOdslony data={odslona.data} poczatkowy={odslona.poczatkowy} className="font-bold" />
        <span className="sr-only">{odslona.kiedy}</span>
      </p>
      <span aria-disabled="true" className={`${s.przycisk} cursor-not-allowed opacity-45`}>
        Zapisz się
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Typy i lint**

Run: `npx tsc --noEmit; npx eslint src/app/landing/LicznikOdslony.tsx src/app/landing/Zaslona.tsx src/app/landing/PrzyciskZapisu.tsx`
Expected: bez błędów.

- [ ] **Step 5: Commit**

```bash
git add src/app/landing/LicznikOdslony.tsx src/app/landing/Zaslona.tsx src/app/landing/PrzyciskZapisu.tsx
git commit -m "Dodaj zasłonę sekcji, licznik odsłony i przycisk zapisu z licznikiem"
```

---

### Task 5: Regulamin bez miejsca przed odsłoną

**Files:**
- Modify: `src/lib/regulamin.ts`, `src/app/regulamin/page.tsx`
- Test: `tests/odslony.test.ts` (dopisz)

- [ ] **Step 1: Dopisz test**

```ts
import { REGULAMIN, regulaminDoWyswietlenia } from "../src/lib/regulamin";

describe("regulamin przed odsłoną ośrodka", () => {
  it("§ 1 ust. 3 bez nazwy, adresu i miasta; reszta bez zmian", () => {
    const zakryty = regulaminDoWyswietlenia(false);
    const ust3 = zakryty[0].ustepy[2];
    expect(ust3).not.toMatch(/Karpacz|Zielone|Poznańsk/);
    expect(ust3).toMatch(/ogłosi przed rozpoczęciem zapisów/);
    expect(zakryty[0].ustepy[0]).toBe(REGULAMIN[0].ustepy[0]);
    expect(zakryty.slice(1)).toEqual(REGULAMIN.slice(1));
  });
  it("po odsłonie pełna treść", () => {
    expect(regulaminDoWyswietlenia(true)).toBe(REGULAMIN);
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/odslony.test.ts` → FAIL (brak eksportu).

- [ ] **Step 3: Dopisz do `src/lib/regulamin.ts` (na końcu)**

```ts
/** § 1 ust. 3 przed odsłoną ośrodka (spec landingu, sekcja 1). */
const USTEP_MIEJSCA_ZAKRYTY =
  "Wydarzenie odbywa się od dnia 23 października 2026 r. do dnia 25 października 2026 r. w ośrodku wypoczynkowym, którego nazwę i adres Organizator ogłosi przed rozpoczęciem zapisów, a także w innych miejscach, w których jest realizowany ogłoszony program.";

/**
 * Regulamin do pokazania. Przed odsłoną ośrodka § 1 ust. 3 nie podaje
 * miejsca. Wersja zgód się nie zmienia: odsłona zapisów odsłania też ośrodek,
 * więc każdy, kto akceptuje regulamin, widzi go w pełnym brzmieniu.
 */
export function regulaminDoWyswietlenia(osrodekOdsloniety: boolean): Paragraf[] {
  if (osrodekOdsloniety) return REGULAMIN;
  return REGULAMIN.map((p) =>
    p.numer === 1 ? { ...p, ustepy: p.ustepy.map((u, i) => (i === 2 ? USTEP_MIEJSCA_ZAKRYTY : u)) } : p,
  );
}
```

- [ ] **Step 4: Strona regulaminu**

W `src/app/regulamin/page.tsx`:
- import: `import { regulaminDoWyswietlenia } from "@/lib/regulamin";` zamiast `REGULAMIN`, oraz `import { wczytajOdslony } from "@/lib/odslony";`
- po odczycie `zatwierdzony` dopisz:

```tsx
  const odslony = await wczytajOdslony(supabase);
  const paragrafy = regulaminDoWyswietlenia(odslony.osrodek.odsloniete);
```

- w JSX zamień `REGULAMIN.map(` na `paragrafy.map(`.

- [ ] **Step 5: Testy, typy, commit**

Run: `npx vitest run tests/odslony.test.ts; npx tsc --noEmit`
Expected: PASS, brak błędów.

```bash
git add src/lib/regulamin.ts src/app/regulamin/page.tsx tests/odslony.test.ts
git commit -m "Nie podawaj miejsca w regulaminie przed odsłoną ośrodka"
```

---

### Task 6: Sekcje z zasłonami — hero, fakty, ośrodek, cena

**Files:**
- Modify: `src/app/landing/Wejscie.tsx`, `src/app/landing/Opis.tsx`, `src/app/landing/KiedyGdzie.tsx`, `src/app/landing/Mapa.tsx`, `src/app/landing/CenaIWplata.tsx`, `src/app/landing/CoZabrac.tsx`
- Rename: `public/hero/osrodek-1.jpg` → `public/hero/o-4c8e1a.jpg`, `public/hero/osrodek-2.jpg` → `public/hero/o-9b2d7f.jpg`

- [ ] **Step 1: Zdjęcia pod losowe nazwy**

```bash
git mv public/hero/osrodek-1.jpg public/hero/o-4c8e1a.jpg
git mv public/hero/osrodek-2.jpg public/hero/o-9b2d7f.jpg
```

- [ ] **Step 2: `Wejscie.tsx` — nowe propsy, linia z datami, przycisk zapisu**

Zmień sygnaturę i dół sekcji:

```tsx
import { DATY_WYJAZDU, type OdslonaWidok } from "@/lib/odslony";
import { PrzyciskZapisu } from "./PrzyciskZapisu";
// (Link przestaje być potrzebny — usuń import.)

export function Wejscie({
  dataJwk,
  zapisy,
  miasto,
}: {
  dataJwk: string | null;
  zapisy: OdslonaWidok;
  /** `null` przed odsłoną ośrodka. */
  miasto: string | null;
}) {
```

W bloku `<div className="grid justify-items-center gap-6">` zastąp `<Licznik …/>` i `<Link …>Zapisz się</Link>`:

```tsx
          <div className="grid justify-items-center gap-6">
            <div className="grid justify-items-center gap-3">
              <Licznik
                docelowa={dataJwk}
                etykieta="Do wyjazdu"
                poTerminie="Trwa"
                poczatkowe={odliczanie(dataJwk, new Date())}
                rozmiar="duzy"
              />
              <p className="text-sm font-bold text-white drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)]">
                {DATY_WYJAZDU} · {miasto ?? "miejsce wkrótce"}
              </p>
            </div>
            <PrzyciskZapisu odslona={zapisy} wariant="hero" />
          </div>
```

- [ ] **Step 3: `Opis.tsx` — nowy tekst i pasek faktów**

```tsx
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/**
 * Czym jest JWK + pasek faktów. Cena i miejsce dochodzą do paska dopiero po
 * swoich odsłonach — przedtem „wkrótce”. Liczby miejsc celowo nie ma
 * (decyzja właściciela).
 */
export function Opis({ kwota, miasto }: { kwota: number | null; miasto: string | null }) {
  const FAKTY = [
    { etykieta: "Czas", wartosc: "3 dni" },
    { etykieta: "Cena", wartosc: kwota ? `${kwota} zł` : "wkrótce" },
    { etykieta: "Miejsce", wartosc: miasto ?? "wkrótce" },
  ];
  return (
    <section id="o-wyjezdzie" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="01" nadtytul="Wyjazd" tytul="Czym to jest" />
        <div className="grid gap-3 text-sm leading-relaxed text-jesien-kora">
          <p>
            Raz w roku Komisja znika z uczelni na trzy dni. JWK to nie jest
            szkolenie ani konferencja — to wyjazd, na który się jedzie, żeby
            naprawdę się poznać, zanim znowu zderzymy się na korytarzu
            z terminami.
          </p>
          <p>
            Nikt nie jedzie sam. Drużyny, gry, szkolenia i wieczory, o których
            mówi się potem cały rok. Tydzień wcześniej przyjmujemy świeżaków —
            kto się załapie, jedzie razem z nami.
          </p>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-2.5">
          {FAKTY.map((f) => (
            <div key={f.etykieta} className="rounded-lg border border-jesien-kora/15 bg-jesien-karta px-3 py-3 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-jesien-rdza">{f.etykieta}</dt>
              <dd className="mt-1 font-tytul text-lg text-jesien-atrament">{f.wartosc}</dd>
            </div>
          ))}
        </dl>
      </Kontener>
    </section>
  );
}
```

- [ ] **Step 4: `Mapa.tsx` — kompaktowa karta z adresem z propsów**

```tsx
"use client";

import { useState } from "react";

/**
 * Mapa w karcie ośrodka: adres, „Otwórz w Mapach” i osadzona mapa dopiero po
 * dotknięciu (ciężki iframe nie leci do każdego, kto przewinął stronę).
 * Adres przychodzi z bazy — w kodzie nie ma żadnego, więc przed odsłoną nie
 * ma go też w skryptach strony.
 */
export function Mapa({ nazwa, adres }: { nazwa: string | null; adres: string }) {
  const [pokaz, setPokaz] = useState(false);
  const pelny = encodeURIComponent([nazwa, adres].filter(Boolean).join(", "));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${pelny}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-full border border-jesien-rdza/40 bg-jesien-tlo px-4 text-sm font-bold text-jesien-rdza"
        >
          Otwórz w Mapach
        </a>
        {!pokaz && (
          <button
            type="button"
            onClick={() => setPokaz(true)}
            className="flex min-h-11 items-center rounded-full border border-jesien-kora/25 px-4 text-sm text-jesien-kora"
          >
            Pokaż mapę tutaj
          </button>
        )}
      </div>
      {pokaz && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg min-[850px]:aspect-[21/9]">
          <iframe
            src={`https://maps.google.com/maps?q=${pelny}&output=embed`}
            title={`Mapa: ${[nazwa, adres].filter(Boolean).join(", ")}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `KiedyGdzie.tsx` — zasłona albo pełna sekcja**

```tsx
import Image from "next/image";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { Mapa } from "./Mapa";
import { DATY_WYJAZDU, type OdslonaWidok } from "@/lib/odslony";

const TLO = "bg-jesien-tlo/70";

function Daty() {
  return (
    <p className="text-sm font-bold text-jesien-atrament">
      {DATY_WYJAZDU} 2026 — od piątku do niedzieli
    </p>
  );
}

/**
 * „Kiedy i gdzie”. Daty jawne zawsze; ośrodek (zdjęcia, nazwa, adres, mapa)
 * dopiero po odsłonie. Zdjęcia leżą pod losowymi nazwami, a ich opisy nie
 * trafiają na stronę przed odsłoną — renderuje je tylko ta gałąź.
 */
export function KiedyGdzie({
  odslona,
  nazwa,
  adres,
}: {
  odslona: OdslonaWidok;
  nazwa: string | null;
  adres: string | null;
}) {
  if (!odslona.odsloniete) {
    return (
      <Zaslona id="kiedy-gdzie" numer="03" nadtytul="Lokalizacja" tytul="Kiedy i gdzie" tlo={TLO} ksztalt="osrodek" odslona={odslona}>
        <Daty />
      </Zaslona>
    );
  }

  return (
    <section id="kiedy-gdzie" className={`${TLO} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="03" nadtytul="Lokalizacja" tytul="Kiedy i gdzie" />
        <Daty />
        <div className="mt-4 grid grid-cols-[1.7fr_1fr] gap-2.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src="/hero/o-4c8e1a.jpg"
              alt="Front budynku ośrodka w słoneczny dzień — biała willa z drewnianym gankiem, czerwonymi parasolami tarasowymi i różami przy wejściu"
              fill
              sizes="(min-width: 850px) 460px, 55vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src="/hero/o-9b2d7f.jpg"
              alt="Brama wjazdowa i podjazd prowadzący do budynku ośrodka"
              fill
              sizes="(min-width: 850px) 220px, 33vw"
              className="object-cover"
            />
          </div>
        </div>
        {(nazwa || adres) && (
          <div className="mt-4 grid gap-3 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
            <div>
              {nazwa && <p className="text-sm font-bold text-jesien-atrament">{nazwa}</p>}
              {adres && <p className="text-sm text-jesien-kora">{adres}</p>}
            </div>
            {adres && <Mapa nazwa={nazwa} adres={adres} />}
          </div>
        )}
      </Kontener>
    </section>
  );
}
```

- [ ] **Step 6: `CenaIWplata.tsx` — zasłona, tło `tlo`, bez zmyślonej kwoty**

```tsx
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { DanePrzelewu } from "@/components/DanePrzelewu";
import type { DanePrzelewu as DanePrzelewuTyp } from "@/lib/zapisy/qrPrzelewu";
import type { OdslonaWidok } from "@/lib/odslony";

const TLO = "bg-jesien-tlo/70";

/**
 * „Cena i wpłata”. Przed odsłoną ceny — zasłona; baza i tak nie wyda wtedy
 * kwoty ani danych do przelewu. Po odsłonie bez danych w panelu: „kwotę
 * podamy wkrótce”, nigdy zmyślona liczba.
 */
export function CenaIWplata({ odslona, przelew }: { odslona: OdslonaWidok; przelew: DanePrzelewuTyp | null }) {
  if (!odslona.odsloniete) {
    return <Zaslona id="cena-i-wplata" numer="05" nadtytul="Koszt" tytul="Cena i wpłata" tlo={TLO} ksztalt="cena" odslona={odslona} />;
  }

  return (
    <section id="cena-i-wplata" className={`${TLO} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener>
        <SekcjaNaglowek numer="05" nadtytul="Koszt" tytul="Cena i wpłata" />
        {przelew ? (
          <p className="font-tytul text-5xl text-jesien-rdza min-[600px]:text-6xl">{przelew.kwota} zł</p>
        ) : (
          <p className="font-tytul text-2xl text-jesien-rdza">Kwotę podamy wkrótce</p>
        )}
        <p className="mt-2 text-sm font-bold text-jesien-atrament">Wpłaty przyjmujemy od 12 do 20 października 2026.</p>
        <p className="mt-4 text-sm leading-relaxed text-jesien-kora">
          Cena obejmuje nocleg i wyżywienie w ośrodku, transport oraz program wyjazdu — dokładny zakres
          poda organizator bliżej terminu.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-jesien-kora">
          Potwierdzenie przelewu wgrywa się w formularzu zgłoszeniowym — warto je zachować, zanim zaczniesz
          wypełniać zgłoszenie. Gdy tura jest pełna, zapisujesz się na listę rezerwową bez wpłaty.
        </p>
        <div className="mt-6">
          <DanePrzelewu
            dane={przelew}
            wariant="jesien"
            tytul="JWK26"
            przypisTytulu="Dopisz w tytule swoje imię i nazwisko — formularz zgłoszeniowy zrobi to za Ciebie."
          />
        </div>
      </Kontener>
    </section>
  );
}
```

- [ ] **Step 7: `CoZabrac.tsx` — miasto z propsów, tło `tlo`**

Zmień sygnaturę na `export function CoZabrac({ miasto }: { miasto: string | null })`, klasę sekcji z `bg-jesien-karta/70` na `bg-jesien-tlo/70`, a akapit na:

```tsx
        <p className="text-sm leading-relaxed text-jesien-kora">
          {miasto ? `${miasto} w drugiej połowie października` : "W górach w drugiej połowie października"} bywa
          zimno i wilgotno — licz się z deszczem, a nawet śniegiem.
        </p>
```

W komentarzu nad komponentem zamień „Karpacz w drugiej połowie października to góry” na „Druga połowa października w górach to”.

- [ ] **Step 8: Typy (page.tsx jeszcze stary — błędy w nim są oczekiwane i znikną w Tasku 8)**

Run: `npx tsc --noEmit`
Expected: błędy wyłącznie w `src/app/page.tsx`.

- [ ] **Step 9: Commit**

```bash
git add public/hero src/app/landing/Wejscie.tsx src/app/landing/Opis.tsx src/app/landing/KiedyGdzie.tsx src/app/landing/Mapa.tsx src/app/landing/CenaIWplata.tsx src/app/landing/CoZabrac.tsx
git commit -m "Zakryj ośrodek i cenę na landingu, dodaj pasek faktów i datę w hero"
```

---

### Task 7: Nowe sekcje — plan, zapisy, pytania, dokumenty, zapowiedź, stopka

**Files:**
- Create: `src/app/landing/Plan.tsx`, `src/app/landing/Zapisy.tsx`, `src/app/landing/Dokumenty.tsx`
- Delete: `src/app/landing/JakSieZapisac.tsx`
- Modify: `src/app/landing/Pytania.tsx`, `src/app/landing/Promocja.tsx`, `src/app/landing/Galeria.tsx`, `src/app/landing/Stopka.tsx`, `src/app/landing/PanelWezwania.tsx`

- [ ] **Step 1: `Plan.tsx`**

```tsx
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { grupujPoDniach, krotkaGodzina, nazwaDnia, type PunktHarmonogramu } from "@/lib/harmonogram";

/**
 * Plan z harmonogramu — wyłącznie punkty oznaczone przez admina „na landing”
 * (odczyt `anon` i tak nie widzi innych). Bez punktów sekcji nie ma.
 */
export function Plan({ punkty }: { punkty: PunktHarmonogramu[] }) {
  const dni = grupujPoDniach(punkty);
  if (dni.length === 0) return null;

  return (
    <section id="plan" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="02" nadtytul="Program" tytul="Plan wyjazdu" />
        <div className="grid gap-4 min-[850px]:grid-cols-3">
          {dni.map((d) => (
            <div key={d.dzien} className="rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">{nazwaDnia(d.dzien)}</h3>
              <ol className="mt-3 grid gap-3">
                {d.punkty.map((p) => (
                  <li key={p.id} className="flex gap-3">
                    <span className="w-11 flex-none font-tytul text-base leading-snug tabular-nums text-jesien-rdza">
                      {krotkaGodzina(p.godzina) ?? "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-jesien-atrament">{p.tytul}</p>
                      {p.opis && <p className="text-sm leading-relaxed text-jesien-kora">{p.opis}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Kontener>
    </section>
  );
}
```

- [ ] **Step 2: `Zapisy.tsx`**

```tsx
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Licznik } from "./Licznik";
import { PrzyciskZapisu } from "./PrzyciskZapisu";
import { odliczanie } from "@/lib/odliczanie";
import type { OdslonaWidok } from "@/lib/odslony";

const KROKI = [
  {
    numer: "01",
    tytul: "Zaloguj się kontem Samorządu",
    opis:
      "Logujesz się jednym dotknięciem przez Google, adresem @samorzad.ue.wroc.pl — " +
      "także jeśli jesteś w Alumni.",
  },
  {
    numer: "02",
    tytul: "Wybierz turę i wypełnij formularz",
    opis:
      "Wybierz swoją turę, zaakceptuj zasady, podaj dane i dołącz czytelne zdjęcie albo zrzut " +
      "ekranu potwierdzenia przelewu. Gdy tura jest pełna, zapiszesz się na listę rezerwową bez wpłaty.",
  },
  {
    numer: "03",
    tytul: "Poczekaj na decyzję",
    opis:
      "Zgłoszenie sprawdza organizator. Może zostać odrzucone, jeśli czegoś zabraknie albo nie da się " +
      "zweryfikować przelewu. Decyzję zobaczysz po zalogowaniu w aplikacji — a jeśli włączysz " +
      "powiadomienia, dostaniesz też powiadomienie.",
  },
] as const;

/**
 * „Zapisy” — tury opisane na stałe (bez stanu na żywo i bez dat; decyzja
 * właściciela), lista rezerwowa, trzy kroki i przycisk zapisu, który do
 * odsłony zapisów jest licznikiem. Licznik przyjęcia świeżaków mieszka
 * w karcie ich tury — tylko tam ma sens.
 */
export function Zapisy({ zapisy, dataSwiezakow }: { zapisy: OdslonaWidok; dataSwiezakow: string | null }) {
  return (
    <section id="zapisy" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="04" nadtytul="Zgłoszenie" tytul="Zapisy" />

        <div className="grid gap-4 min-[850px]:grid-cols-3">
          <div className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Działacze</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">
              Osoby działające w komisjach, jednostkach i projektach Samorządu. Ich tura rusza pierwsza.
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Świeżaki</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">
              Nowi członkowie Samorządu przyjęci w tegorocznej rekrutacji. Tura rusza po przyjęciu świeżaków.
            </p>
            <Licznik
              docelowa={dataSwiezakow}
              etykieta="Do przyjęcia świeżaków"
              poTerminie="Przyjęcie za nami"
              poczatkowe={odliczanie(dataSwiezakow, new Date())}
            />
          </div>
          <div className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Alumni</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">Byli członkowie Samorządu. Tura rusza na końcu.</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-jesien-kora">
          Każda tura ma ustaloną liczbę miejsc. Gdy się zapełni, zapiszesz się na listę rezerwową bez
          wpłaty — jeśli ktoś zrezygnuje, organizator przesuwa kolejną osobę z rezerwy i prosi ją
          o wpłatę. Otwarcie każdej tury ogłaszamy na Instagramie.
        </p>

        <div className="mt-8 grid gap-4 min-[850px]:grid-cols-3">
          {KROKI.map((k) => (
            <div key={k.numer} className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
              <span className="font-tytul text-2xl text-jesien-rdza/40">{k.numer}</span>
              <h3 className="font-tytul text-lg text-jesien-atrament">{k.tytul}</h3>
              <p className="text-sm leading-relaxed text-jesien-kora">{k.opis}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <PrzyciskZapisu odslona={zapisy} wariant="sekcja" />
        </div>
      </Kontener>
    </section>
  );
}
```

Usuń stary plik: `git rm src/app/landing/JakSieZapisac.tsx`.

- [ ] **Step 3: `Pytania.tsx` — nowe pytania, kontakt do koordynatora, tło `karta`**

Zastąp stałe `PYTANIA` i `KONTAKT_MAIL` oraz dół komponentu:

```tsx
import { KOORDYNATOR_MAIL, KOORDYNATOR_TELEFON } from "@/lib/regulamin";

const PYTANIA = [
  {
    pytanie: "Kto może jechać?",
    odpowiedz:
      "Pełnoletnie osoby z komisji, jednostek i projektów Samorządu, świeżaki przyjęci w tegorocznej " +
      "rekrutacji i Alumni — wszyscy logują się kontem @samorzad.ue.wroc.pl. Szczegóły w § 3 regulaminu.",
  },
  {
    pytanie: "Co, jeśli tura jest pełna?",
    odpowiedz:
      "Zapiszesz się na listę rezerwową bez wpłaty. Gdy zwolni się miejsce, organizator przesuwa kolejną " +
      "osobę z rezerwy i prosi ją o wpłatę.",
  },
  {
    pytanie: "Co, jeśli zrezygnuję?",
    odpowiedz:
      "Napisz do koordynatora jak najszybciej. Skutki finansowe rezygnacji określają warunki płatności " +
      "przekazane przed wpłatą (§ 17 regulaminu).",
  },
  {
    pytanie: "Jak dojeżdżamy?",
    odpowiedz:
      "Autokarem albo własnym transportem — w formularzu wybierasz autokar w obie strony, tylko tam, tylko " +
      "z powrotem albo dojazd własny. Godzinę i miejsce zbiórki podamy przed wyjazdem.",
  },
  {
    pytanie: "Co z jedzeniem i dietami?",
    odpowiedz:
      "Dietę i alergie podajesz w formularzu, dobrowolnie. Ośrodek dostaje wyłącznie te informacje.",
  },
  {
    pytanie: "Czy zgłoszenie może zostać odrzucone?",
    odpowiedz:
      "Tak, jeśli w formularzu czegoś zabraknie albo nie da się zweryfikować potwierdzenia przelewu. " +
      "Decyzję zobaczysz po zalogowaniu w aplikacji.",
  },
] as const;
```

Klasa sekcji: `bg-jesien-karta/70` zamiast `bg-jesien-tlo/70`; karty `<details>` dostają `bg-jesien-tlo/80` zamiast `bg-jesien-karta`. Numer nagłówka: `numer="08"`. Końcowy akapit zastąp:

```tsx
        <div className="mt-6 grid gap-1 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5 text-sm">
          <p className="font-bold text-jesien-atrament">Nie znalazłeś odpowiedzi? Koordynator wyjazdu: Dawid Rutkowski</p>
          <a href={`mailto:${KOORDYNATOR_MAIL}`} className="w-fit font-bold text-jesien-rdza underline underline-offset-2">
            {KOORDYNATOR_MAIL}
          </a>
          <a href={`tel:${KOORDYNATOR_TELEFON.replace(/\s/g, "")}`} className="w-fit text-jesien-rdza underline underline-offset-2">
            {KOORDYNATOR_TELEFON}
          </a>
        </div>
```

- [ ] **Step 4: `Dokumenty.tsx`**

```tsx
import Link from "next/link";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/** Regulamin i polityka prywatności — osobne trasy, żeby dało się je linkować. */
export function Dokumenty() {
  const DOKUMENTY = [
    { href: "/regulamin", tytul: "Regulamin", opis: "Kto może jechać, jak wygląda zgłoszenie i czego oczekujemy na miejscu." },
    { href: "/prywatnosc", tytul: "Polityka prywatności", opis: "Jakie dane zbiera aplikacja, po co i jak długo je trzymamy." },
  ];
  return (
    <section id="dokumenty" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="09" nadtytul="Zasady" tytul="Zasady i dokumenty" />
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          {DOKUMENTY.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="grid gap-1 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5 transition hover:border-jesien-rdza/40
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
            >
              <span className="font-tytul text-lg text-jesien-atrament">{d.tytul}</span>
              <span className="text-sm leading-relaxed text-jesien-kora">{d.opis}</span>
              <span className="mt-1 text-sm font-bold text-jesien-rdza">Przeczytaj →</span>
            </Link>
          ))}
        </div>
      </Kontener>
    </section>
  );
}
```

- [ ] **Step 5: `Promocja.tsx` — stała `FILM`, niska ramka „wkrótce”, numer 06**

Zastąp blok ramki (od `<div className="relative mt-10">` do końca `</div>` z żabą) i dodaj stałą nad komponentem:

```tsx
/**
 * Film tej edycji. Podmiana = pliki w `public/film/` i jedna linia tutaj,
 * np. `{ src: "/film/zapowiedz.mp4", plakat: "/film/zapowiedz.jpg" }`.
 */
const FILM: { src: string; plakat: string } | null = null;
```

```tsx
        <div className="relative mt-10">
          {FILM ? (
            <video
              controls
              preload="none"
              poster={FILM.plakat}
              className="aspect-video w-full rounded-lg bg-jesien-atrament"
            >
              <source src={FILM.src} type="video/mp4" />
            </video>
          ) : (
            <div className="flex items-center gap-4 rounded-lg border-2 border-dashed border-jesien-dynia/60 bg-jesien-tlo/70 py-5 pl-24 pr-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Wkrótce</p>
                <p className="text-sm text-jesien-kora">Film tej edycji pojawi się tutaj, gdy tylko powstanie.</p>
              </div>
            </div>
          )}
          <Zaba
            stan="powitanie"
            className="absolute -top-5 left-3 size-16 text-jesien-mech drop-shadow-[0_6px_14px_rgb(47_33_24/0.3)]"
          />
        </div>
```

Nagłówek: `numer="06"`. Akapit nad galerią: „Film z tej edycji pojawi się tutaj, gdy tylko powstanie. Na razie — jak było poprzednim razem.”

- [ ] **Step 6: `Galeria.tsx` — bez osieroconego zdjęcia**

Zmień `const WIDOCZNE_NA_START = 5;` na `4` i komentarz nad nim na: „Cztery na start: na telefonie dwa rzędy po dwa, na komputerze jeden pełny rząd — przy pięciu piąte zdjęcie wisiało samo pod spodem.”

- [ ] **Step 7: `PanelWezwania.tsx` — przycisk zapisu z licznikiem**

Dodaj props `{ zapisy }: { zapisy: OdslonaWidok }` (import `type OdslonaWidok` z `@/lib/odslony` i `PrzyciskZapisu` z `./PrzyciskZapisu`), usuń import `Link`, a cały `<Link href="/wejscie" className="stopka-cta …">…</Link>` zastąp:

```tsx
        <div className="mt-[31px] min-[600px]:mt-6">
          <PrzyciskZapisu odslona={zapisy} wariant="panel" />
        </div>
```

(`PrzyciskZapisu` jest komponentem serwerowym bez stanu — w kliencie `PanelWezwania` renderuje się jako zwykłe dziecko; `LicznikOdslony` w nim jest klientowy.)

- [ ] **Step 8: `Stopka.tsx` — propsy, nawigacja, polityka, kontakt, social z ustawień**

Zastąp stałe i sygnaturę:

```tsx
import { KOORDYNATOR_MAIL } from "@/lib/regulamin";
import type { Social } from "@/lib/ustawienia";
import type { OdslonaWidok } from "@/lib/odslony";

export function Stopka({ zapisy, social, maPlan }: { zapisy: OdslonaWidok; social: Social; maPlan: boolean }) {
  const NAWIGACJA_WYJAZD: Odnosnik[] = [
    { etykieta: "Czym to jest", href: "#o-wyjezdzie" },
    ...(maPlan ? [{ etykieta: "Plan", href: "#plan" }] : []),
    { etykieta: "Kiedy i gdzie", href: "#kiedy-gdzie" },
    { etykieta: "Zdjęcia", href: "#promocja" },
  ];
  const NAWIGACJA_ZGLOSZENIE: Odnosnik[] = [
    { etykieta: "Zapisy", href: zapisy.odsloniete ? "/wejscie" : "#zapisy" },
    { etykieta: "Pytania", href: "#pytania" },
    { etykieta: "Kontakt", href: `mailto:${KOORDYNATOR_MAIL}` },
    { etykieta: "Regulamin", href: "/regulamin" },
    { etykieta: "Polityka prywatności", href: "/prywatnosc" },
  ];
  const maSpolecznosci = social.instagram || social.facebook;
```

W JSX: `<PanelWezwania zapisy={zapisy} />`; `SPOLECZNOSCI.instagram` → `social.instagram`, `SPOLECZNOSCI.facebook` → `social.facebook` (w warunkach i w `href`); opis marki: „Jesienny Wyjazd Komisji to trzy dni w górach, na które jedzie Samorząd Studentów Uniwersytetu Ekonomicznego we Wrocławiu. Integracja, rywalizacja i kilka rzeczy, o których lepiej nie pisać.”; dolny pasek — obok „Regulamin wyjazdu” drugi link:

```tsx
          <div className="flex flex-wrap gap-x-5">
            <Link href="/regulamin" className="flex min-h-11 w-fit items-center text-[10.5px] text-jesien-kora underline underline-offset-[3px] transition hover:text-jesien-atrament focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza">
              Regulamin wyjazdu
            </Link>
            <Link href="/prywatnosc" className="flex min-h-11 w-fit items-center text-[10.5px] text-jesien-kora underline underline-offset-[3px] transition hover:text-jesien-atrament focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza">
              Polityka prywatności
            </Link>
          </div>
```

Copyright: „© 2026 Samorząd Studentów UE we Wrocławiu”. Usuń stałe `SPOLECZNOSCI` i `KONTAKT_MAIL` oraz komentarze o placeholderach.

- [ ] **Step 9: Typy (błędy tylko w `src/app/page.tsx`), commit**

Run: `npx tsc --noEmit` → błędy wyłącznie w `src/app/page.tsx`.

```bash
git add -A src/app/landing
git commit -m "Dodaj plan, tury zapisów i dokumenty; przepisz pytania, zapowiedź i stopkę"
```

---

### Task 8: Strona główna — kolejność, odczyty, metadane, obrazek podglądu

**Files:**
- Modify: `src/app/page.tsx`
- Create: `scripts/grafika/og.mjs`, `src/app/opengraph-image.jpg`, `src/app/opengraph-image.alt.txt`

- [ ] **Step 1: Przepisz `src/app/page.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { ustawienia, social } from "@/lib/ustawienia";
import { createClient } from "@/lib/supabase/server";
import { wczytajDanePrzelewu } from "@/lib/zapisy/przelewUstawienia";
import { DATY_WYJAZDU, miastoZAdresu, wczytajOdslony, widokOdslon } from "@/lib/odslony";
import type { PunktHarmonogramu } from "@/lib/harmonogram";
import { Naglowek } from "./landing/Naglowek";
import { Wejscie } from "./landing/Wejscie";
import { Opis } from "./landing/Opis";
import { Plan } from "./landing/Plan";
import { KiedyGdzie } from "./landing/KiedyGdzie";
import { Zapisy } from "./landing/Zapisy";
import { CenaIWplata } from "./landing/CenaIWplata";
import { Promocja } from "./landing/Promocja";
import { CoZabrac } from "./landing/CoZabrac";
import { Pytania } from "./landing/Pytania";
import { Dokumenty } from "./landing/Dokumenty";
import { Liscie } from "./landing/Liscie";
import { Stopka } from "./landing/Stopka";
import { DzielnikFala, DzielnikSzewron, DzielnikSkos, DzielnikLisc } from "./landing/Dzielniki";

const TYTUL = "Jesienny Wyjazd Komisji 2026";

/**
 * Metadane liczone per żądanie: przed odsłoną ośrodka opis i podgląd linku
 * nie mogą podać miasta. Tytuł, `appleWebApp` i `themeColor` nadpisują
 * mroczne wartości z `layout.tsx` (motyw sekty nie wycieka nawet w meta).
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const [odslony, { miejsceAdres }] = await Promise.all([wczytajOdslony(supabase), ustawienia()]);
  const miasto = odslony.osrodek.odsloniete ? miastoZAdresu(miejsceAdres) : null;
  const opis = `${DATY_WYJAZDU}${miasto ? `, ${miasto}` : ""}. Wyjazd integracyjny Samorządu Studentów UEW — zapisz się.`;
  return {
    metadataBase: new URL("https://www.jwk26.pl"),
    title: TYTUL,
    description: opis,
    openGraph: { title: TYTUL, description: opis, type: "website", locale: "pl_PL" },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Jesienny Wyjazd Komisji" },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf3e7",
  viewportFit: "cover",
};

/**
 * Landing. Kolejność pod zapisy (spec landingu, wariant B). Zakryte sekcje
 * decyduje baza (`odslony()`), a polityki `app_settings` przed odsłoną nie
 * wydają miejsca ani danych przelewu — więc i tak nie ma ich czym wyrenderować.
 */
export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Kod logowania, który wylądował na stronie głównej zamiast na /auth/callback
  // (Supabase odsyła na Site URL, gdy adresu powrotu nie ma na liście).
  const { code } = await searchParams;
  if (typeof code === "string" && code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const [{ dataJwk, dataSwiezakow, miejsceNazwa, miejsceAdres }, przelew, odslonySurowe, adresySocial, { data: planRaw }] =
    await Promise.all([
      ustawienia(),
      wczytajDanePrzelewu(supabase),
      wczytajOdslony(supabase),
      social(),
      // Jawnie tylko punkty na landing — zalogowany przyjęty widziałby inaczej cały harmonogram.
      supabase
        .from("harmonogram")
        .select("id, dzien, godzina, tytul, opis")
        .eq("na_landingu", true)
        .order("dzien")
        .order("godzina", { nullsFirst: true }),
    ]);

  const odslony = widokOdslon(odslonySurowe, new Date());
  const miasto = odslony.osrodek.odsloniete ? miastoZAdresu(miejsceAdres) : null;
  const kwota = odslony.cena.odsloniete ? (przelew?.kwota ?? null) : null;
  const plan = (planRaw ?? []) as PunktHarmonogramu[];

  return (
    <div className="jesien relative">
      {/* Liście pod treścią, nad tłem — patrz historia tego pliku. */}
      <Liscie />

      <div className="relative z-10">
        <Naglowek />
        <Wejscie dataJwk={dataJwk} zapisy={odslony.zapisy} miasto={miasto} />
        <DzielnikFala kolorKlasa="text-jesien-tlo" tloKlasa="bg-noc" />

        <Opis kwota={kwota} miasto={miasto} />
        <DzielnikSzewron />

        {plan.length > 0 && (
          <>
            <Plan punkty={plan} />
            <DzielnikSkos kolorKlasa="bg-jesien-tlo" tloKlasa="bg-jesien-karta" />
          </>
        )}

        <KiedyGdzie
          odslona={odslony.osrodek}
          nazwa={odslony.osrodek.odsloniete ? miejsceNazwa : null}
          adres={odslony.osrodek.odsloniete ? miejsceAdres : null}
        />
        <DzielnikSkos kolorKlasa="bg-jesien-karta" tloKlasa="bg-jesien-tlo" />

        <Zapisy zapisy={odslony.zapisy} dataSwiezakow={dataSwiezakow} />
        <DzielnikSzewron />

        <CenaIWplata odslona={odslony.cena} przelew={odslony.cena.odsloniete ? przelew : null} />
        <DzielnikFala kolorKlasa="text-jesien-karta" tloKlasa="bg-jesien-tlo" />

        <Promocja />
        <DzielnikLisc />

        <CoZabrac miasto={miasto} />
        <DzielnikSzewron />

        <Pytania />
        <DzielnikSzewron />

        <Dokumenty />

        <Stopka zapisy={odslony.zapisy} social={adresySocial} maPlan={plan.length > 0} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Obrazek podglądu linku**

```js
// scripts/grafika/og.mjs
// Obrazek podglądu linku (1200×630): zdjęcie z hero, przyciemnienie od dołu
// i białe logo. Bez miejsca i bez dat — jeden obraz na cały okres zasłon.
// Uruchomienie: node scripts/grafika/og.mjs
import sharp from "sharp";

const W = 1200;
const H = 630;
const tlo = await sharp("public/hero/hero-8.jpg").resize(W, H, { fit: "cover", position: "attention" }).toBuffer();
const przyciemnienie = Buffer.from(
  `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="#0c0709" stop-opacity="0.35"/>
     <stop offset="1" stop-color="#0c0709" stop-opacity="0.7"/></linearGradient></defs>
     <rect width="100%" height="100%" fill="url(#g)"/></svg>`,
);
const logo = await sharp("public/logo/logo-biale.png").resize({ width: 760 }).toBuffer();
const { height: hLogo = 283 } = await sharp(logo).metadata();

await sharp(tlo)
  .composite([
    { input: przyciemnienie, top: 0, left: 0 },
    { input: logo, top: Math.round((H - hLogo) / 2), left: Math.round((W - 760) / 2) },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile("src/app/opengraph-image.jpg");
console.log("zapisano src/app/opengraph-image.jpg");
```

Run: `node scripts/grafika/og.mjs` → `zapisano src/app/opengraph-image.jpg`.

Utwórz `src/app/opengraph-image.alt.txt` z treścią:

```
Jesienny Wyjazd Komisji 2026 — logo na zdjęciu uczestników poprzedniej edycji
```

Obejrzyj plik (Read na `src/app/opengraph-image.jpg`) i pokaż go właścicielowi przed commitem (zasada z `CLAUDE.md`).

- [ ] **Step 3: Typy, lint, testy jednostkowe**

Run: `npx tsc --noEmit; npx eslint src/app/page.tsx src/app/landing src/lib/odslony.ts; npx vitest run tests/odslony.test.ts tests/bramka.test.ts`
Expected: bez błędów, testy PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx scripts/grafika/og.mjs src/app/opengraph-image.jpg src/app/opengraph-image.alt.txt
git commit -m "Ułóż landing pod zapisy, licz metadane per żądanie i dodaj podgląd linku"
```

---

### Task 9: Panel — daty odsłon, adresy social, plan na landing

**Files:**
- Create: `src/app/app/admin/ustawienia/FormularzOdslon.tsx`
- Modify: `src/app/app/admin/ustawienia/page.tsx`, `src/app/app/admin/ustawienia/Formularz.tsx`, `src/lib/harmonogram.ts`, `src/app/app/admin/harmonogram/page.tsx`, `src/app/app/admin/harmonogram/Edytor.tsx`

- [ ] **Step 1: `Formularz.tsx` — eksport pomocników strefy, neutralne placeholdery**

- `function naDatetimeLocal` → `export function naDatetimeLocal`; `function naIso` → `export function naIso`.
- placeholder „OW Zielone Wzgórze” → „Nazwa ośrodka”; „Poznańska 5, 58-540 Karpacz” → „Ulica 1, 00-000 Miasto”.

- [ ] **Step 2: `FormularzOdslon.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { naDatetimeLocal, naIso } from "./Formularz";

export type PoczatkoweOdslony = {
  osrodek: string | null;
  cena: string | null;
  zapisy: string | null;
  instagram: string;
  facebook: string;
};

/**
 * Daty odsłon landingu i adresy profili. Pusta data = sekcja odsłonięta od
 * razu; odsłona zapisów odsłania wszystko. Adres profilu musi być adresem
 * w swoim serwisie (pilnuje tego też baza).
 */
export function FormularzOdslon({ poczatkowe }: { poczatkowe: PoczatkoweOdslony }) {
  const router = useRouter();
  const [osrodek, setOsrodek] = useState(naDatetimeLocal(poczatkowe.osrodek));
  const [cena, setCena] = useState(naDatetimeLocal(poczatkowe.cena));
  const [zapisy, setZapisy] = useState(naDatetimeLocal(poczatkowe.zapisy));
  const [instagram, setInstagram] = useState(poczatkowe.instagram);
  const [facebook, setFacebook] = useState(poczatkowe.facebook);
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState(false);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function zapisz() {
    if (wToku.current) return;
    setBlad(null);
    setUdane(false);
    if (instagram.trim() && !instagram.trim().startsWith("https://www.instagram.com/")) {
      setBlad("Adres Instagrama musi zaczynać się od https://www.instagram.com/");
      return;
    }
    if (facebook.trim() && !facebook.trim().startsWith("https://www.facebook.com/")) {
      setBlad("Adres Facebooka musi zaczynać się od https://www.facebook.com/");
      return;
    }

    wToku.current = true;
    setCzeka(true);
    const zmiany: Record<string, string> = {
      odslona_osrodek: osrodek ? naIso(osrodek) : "",
      odslona_cena: cena ? naIso(cena) : "",
      odslona_zapisy: zapisy ? naIso(zapisy) : "",
      social_instagram: instagram.trim(),
      social_facebook: facebook.trim(),
    };
    const { error } = await createClient()
      .from("app_settings")
      .upsert(Object.entries(zmiany).map(([key, value]) => ({ key, value })), { onConflict: "key" });
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Zapis odsłon nie przeszedł:", { code: error.code, message: error.message });
      setBlad("Zapis się nie udał. Sprawdź adresy profili i spróbuj jeszcze raz.");
      return;
    }
    setUdane(true);
    router.refresh();
  }

  return (
    <section className="mt-8 grid gap-4">
      <h2 className="text-sm font-bold">Odsłony na landingu</h2>
      <p className="text-xs leading-relaxed text-dym">
        Do tych chwil landing pokazuje zasłonę z licznikiem. Otwarcie zapisów odsłania też ośrodek i cenę.
        Puste pole = odsłonięte od razu.
      </p>
      <Field label="Ośrodek i miasto" type="datetime-local" value={osrodek} onChange={(e) => setOsrodek(e.target.value)} />
      <Field label="Cena i dane do przelewu" type="datetime-local" value={cena} onChange={(e) => setCena(e.target.value)} />
      <Field label="Zapisy" type="datetime-local" value={zapisy} onChange={(e) => setZapisy(e.target.value)} />

      <h2 className="mt-4 text-sm font-bold">Profile w stopce</h2>
      <Field label="Instagram" placeholder="https://www.instagram.com/…" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
      <Field label="Facebook" placeholder="https://www.facebook.com/…" value={facebook} onChange={(e) => setFacebook(e.target.value)} />

      {blad && <p role="alert" className="text-sm text-krew-jasna">{blad}</p>}
      {udane && <p role="status" className="text-sm text-krew-jasna">Zapisano</p>}
      <Button onClick={() => void zapisz()} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Zapisz odsłony i profile"}
      </Button>
    </section>
  );
}
```

- [ ] **Step 3: `ustawienia/page.tsx` — odczyt i render**

Do listy kluczy w `.in("key", [...])` dopisz `"odslona_osrodek", "odslona_cena", "odslona_zapisy", "social_instagram", "social_facebook"`. Import `FormularzOdslon`. Pod `<FormularzPrzelewu …/>`:

```tsx
      <FormularzOdslon
        poczatkowe={{
          osrodek: mapa.get("odslona_osrodek") || null,
          cena: mapa.get("odslona_cena") || null,
          zapisy: mapa.get("odslona_zapisy") || null,
          instagram: String(mapa.get("social_instagram") ?? ""),
          facebook: String(mapa.get("social_facebook") ?? ""),
        }}
      />
```

Podtytuł ekranu (oba wystąpienia): „Daty, miejsce, odsłony i profile”.

- [ ] **Step 4: Harmonogram — typ, odczyt, przełącznik**

`src/lib/harmonogram.ts` — do typu `PunktHarmonogramu` dopisz `na_landingu?: boolean;`.

`src/app/app/admin/harmonogram/page.tsx` — select: `"id, dzien, godzina, tytul, opis, na_landingu"`.

`src/app/app/admin/harmonogram/Edytor.tsx`:
- w `FormularzPunktu` stan `const [naLandingu, setNaLandingu] = useState(punkt?.na_landingu ?? false);`, a `wiersz` dostaje `na_landingu: naLandingu`; po dodaniu nowego punktu `setNaLandingu(false)`;
- nad komunikatem błędu:

```tsx
      <label className="flex min-h-11 items-start gap-3 text-sm text-kosc">
        <input
          type="checkbox"
          checked={naLandingu}
          onChange={(e) => setNaLandingu(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-krew)]"
        />
        <span>
          Pokaż na landingu
          <span className="block text-xs text-dym">
            Publiczne — bez motywu wyjazdu i bez nazwy miejsca przed jego odsłoną.
          </span>
        </span>
      </label>
```

- w `PunktDoEdycji`, pod tytułem punktu: `{punkt.na_landingu && <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-krew-jasna">Na landingu</p>}`.

- [ ] **Step 5: Typy, lint, commit**

Run: `npx tsc --noEmit; npx eslint src/app/app/admin/ustawienia src/app/app/admin/harmonogram src/lib/harmonogram.ts`
Expected: bez błędów.

```bash
git add src/app/app/admin/ustawienia src/app/app/admin/harmonogram src/lib/harmonogram.ts
git commit -m "Dodaj w panelu daty odsłon, profile social i plan na landing"
```

---

### Task 10: Kontrola przecieku, przegląd i wdrożenie

**Files:**
- Create: `scripts/sprawdz-przeciek.mjs`

- [ ] **Step 1: Skrypt kontroli**

```js
// scripts/sprawdz-przeciek.mjs
// Kontrola przecieku landingu: HTML stron publicznych i skrypty ładowane
// przez landing nie mogą zawierać miejsca, ceny ani słów motywu.
// Użycie: node scripts/sprawdz-przeciek.mjs https://www.jwk26.pl [--odsloniete-osrodek] [--odslonieta-cena]
const baza = process.argv[2] ?? "http://localhost:3100";
const osrodekJawny = process.argv.includes("--odsloniete-osrodek");
const cenaJawna = process.argv.includes("--odslonieta-cena");

const zakazane = [
  /sekt/i, /rytua/i, /kapła/i, /sanktuar/i,
  ...(osrodekJawny ? [] : [/Karpacz/, /Zielone Wzg/, /Pozna[nń]sk/, /o-4c8e1a/, /o-9b2d7f/, /osrodek-\d/]),
  ...(cenaJawna ? [] : [/\b\d{3} zł/, /przelew_kwota/]),
];

async function tekst(url) {
  const r = await fetch(url, { redirect: "follow" });
  return r.text();
}

const strony = ["/", "/regulamin", "/prywatnosc"];
const zrodla = new Map();
for (const s of strony) {
  const html = await tekst(baza + s);
  zrodla.set(`HTML ${s}`, html);
  if (s === "/") {
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      zrodla.set(`JS ${src}`, await tekst(new URL(src, baza).href));
    }
  }
}

let bledy = 0;
for (const [nazwa, tresc] of zrodla) {
  for (const wzor of zakazane) {
    const m = tresc.match(wzor);
    if (m) {
      bledy++;
      const i = m.index ?? 0;
      console.log(`✗ ${nazwa}: ${wzor} → …${tresc.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " ")}…`);
    }
  }
}
console.log(bledy ? `Przecieki: ${bledy}` : `✓ Czysto (${zrodla.size} źródeł)`);
process.exit(bledy ? 1 : 0);
```

- [ ] **Step 2: Kontrola na dev serwerze (baza testowa, odsłony w przyszłości)**

Ustaw na bazie testowej daty odsłon w przyszłości (domyślne z migracji są w przyszłości do 5.10). Dev serwer na bazie testowej działa pod `http://localhost:3100` (jak w poprzednich planach).

Run: `node scripts/sprawdz-przeciek.mjs http://localhost:3100`
Expected: `✓ Czysto (N źródeł)`. Każde `✗` to błąd do poprawienia przed wdrożeniem (np. słowo motywu w manifeście albo w metadanych z `layout.tsx`).

- [ ] **Step 3: Przegląd wizualny (Playwright ze scratchpada)**

Zrzuty telefon 390×844 i komputer 1440×900 całego `/` przed odsłoną; potem na bazie testowej `odslona_zapisy` na przeszłość i zrzuty po odsłonie; sprawdź:
- licznik nad wyszarzonym przyciskiem w hero, sekcji Zapisy i panelu stopki;
- atrapy w „Kiedy i gdzie” i „Cena i wpłata” z czytelnym licznikiem;
- plan (szkic) po dniach; stopka bez ikon social (puste adresy);
- po odsłonie: zdjęcia ośrodka, karta z mapą, kwota, „Zapisz się” prowadzi na `/wejscie`;
- licznik doprowadzony do zera (data odsłony = teraz + 20 s) odsłania sekcję bez przeładowania.

Przywróć daty na bazie testowej do domyślnych.

- [ ] **Step 4: Pełne testy**

Run: `npx vitest run`
Expected: wszystkie PASS.

- [ ] **Step 5: Wdrożenie**

```bash
npx supabase link --project-ref tjjlslupthlylnxvfroz
npx supabase db push --dry-run   # dwie migracje: 20260929200000_odslony, 20260929200100_harmonogram_landing
npx supabase db push --yes
npx supabase link --project-ref cmuyeoobmidawmyxwihk
git add scripts/sprawdz-przeciek.mjs
git commit -m "Dodaj kontrolę przecieku landingu"
git push origin main
```

Po wdrożeniu Vercela: `node scripts/sprawdz-przeciek.mjs https://www.jwk26.pl` → `✓ Czysto`. Dodatkowo niezalogowane zapytanie REST o `miejsce_nazwa` i `przelew_kwota` kluczem anon z produkcji zwraca pustą listę.

---

## Self-review (wykonany)

- **Pokrycie specu:** zasłony z datami i regułą porządku (T1, T3), odcięcie w bazie (T1), atrapa + licznik + odświeżenie (T4), zamiennik przycisku zapisu w hero/sekcji/panelu/stopce (T4, T6, T7), regulamin bez miejsca (T5), miasto znika z metadanych/hero/stopki/„Co zabrać” (T6–T8), losowe nazwy zdjęć (T6), pasek faktów bez liczby miejsc (T6), plan z harmonogramu + szkic + przełącznik (T2, T7, T9), tury + licznik świeżaków + kroki (T7), FAQ + kontakt (T7), dokumenty (T7), stopka + social z ustawień + walidacja (T1, T7, T9), ramka filmu i galeria (T7), `generateMetadata` + obrazek podglądu (T8), obsługa błędów: awaria odsłon = zakryte (T3), ponawianie odświeżenia (T4), brak planu = brak sekcji (T7), brak social = brak ikon (T7); testy 1–7 ze specu (T1–T5, T10). Żaba — plan 16b.
- **Nazwy:** `OdslonaWidok`, `widokOdslon`, `wczytajOdslony`, `czyOdsloniete`, `tekstOdliczania`, `kiedyOdslona`, `miastoZAdresu`, `DATY_WYJAZDU`, `regulaminDoWyswietlenia`, `social()`/`Social`, `PrzyciskZapisu` (warianty `hero|sekcja|panel`), `Zaslona` (`ksztalt: osrodek|cena`) — spójne we wszystkich taskach.
- **Uwaga wykonawcza:** `PanelWezwania` jest klientowy i renderuje `PrzyciskZapisu` (bez dyrektywy, bez stanu) — to dozwolone, bo `PrzyciskZapisu` nie importuje niczego serwerowego (`@/lib/odslony` importuje tylko typ klienta Supabase, ale `PrzyciskZapisu` bierze z niego wyłącznie `type`).
