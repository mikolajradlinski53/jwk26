# Drużyny bez nazw: głosowanie na kapitana i nazwa od kapitana - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drużyny startują jako „Drużyna 1…4”, wybierają kapitana głosowaniem w aplikacji, a kapitan raz nadaje nazwę i motto; ranking pokazuje skład bez punktów osób.

**Architecture:** `teams.name` zawsze trzyma nazwę do pokazania (najpierw „Drużyna N”), więc wszystkie dotychczasowe miejsca wyświetlania działają bez zmian. Głosowanie i nadawanie nazwy to funkcje `security definer` w Postgresie; tabela głosów jest niedostępna dla uczestników. Interfejs: karta „Twoja drużyna” nad rankingiem (komponent kliencki czytający `stan_glosowania()`), przyciski admina w panelu „Drużyny”.

**Tech Stack:** Next 16 (App Router, `proxy.ts`), Supabase (Postgres, RLS, pg_net/push przez `powiadomienia`), Vitest (testy bazy na projekcie `jwk26_test`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-09-druzyny-kapitan-nazwa-design.md`

## Global Constraints

- Nazwa drużyny: 1-30 znaków po `btrim`; motto: 0-60 znaków po `btrim` (puste → NULL).
- Nazwa unikalna wśród drużyn bez rozróżniania wielkości liter.
- Placeholder: dokładnie `'Drużyna ' || numer`.
- Etapy głosowania: `nie_rozpoczete`, `trwa`, `zakonczone` (tekst z CHECK).
- Głosują i są kandydatami wyłącznie członkowie drużyny z `profiles.status = 'approved'`.
- Remis → losowanie w bazie (`order by random() limit 1`).
- Wszystkie funkcje: `security definer`, `set search_path = ''`, nazwy obiektów z prefiksem `public.`.
- Komunikaty błędów w SQL bez polskich znaków (konwencja repo), tłumaczone w `src/lib/zapisy/bledy.ts`.
- Teksty interfejsu po polsku, zwykłe myślniki „-”, nie długie.
- Migracje: nowy plik na każdą zmianę; `db push` nie wykona ponownie zastosowanego pliku.
- Odstępstwo od specu: `teams.numer` jest nullable (unikalny) - drużyna zakładana ręcznie przez admina (istniejący test `teams.test.ts`) nie ma numeru; zasiane 1-4 mają.

## Review Focus

- Dwa ostatnie głosy w tej samej chwili - oba widzą „brakuje jednego” i nikt nie zamyka: `for update` na wierszu drużyny serializuje głosy (test: wszyscy głosują po kolei - zamknięcie po ostatnim; wyścig pilnuje blokada).
- Członek odrzucony/przeniesiony w trakcie głosowania - jego stary głos nie może liczyć się w drużynie: liczenie tylko głosów osób nadal przyjętych i w tej drużynie (test w Task 1).
- Kapitan wpisuje nazwę z samych spacji albo 31 znaków - odrzucenie, nazwa zostaje niezablokowana (test w Task 2).
- Kapitan próbuje nadać nazwę drugi raz (np. podwójne stuknięcie) - drugi raz odpada z `NAZWA_JUZ_NADANA`, pierwsza nazwa zostaje (test w Task 2).
- Drużyna bez głosów zamknięta przez admina - etap `zakonczone`, kapitan pusty, karta mówi „Kapitana wskaże organizator” (test w Task 1, widok w Task 3).

---

## File Structure

- Create: `supabase/migrations/20261009120000_druzyny_glosowanie.sql` - kolumny, reset, tabela głosów, funkcje głosowania.
- Create: `supabase/migrations/20261009120100_druzyny_nazwa.sql` - nadawanie i odblokowanie nazwy.
- Create: `tests/db/kapitan.test.ts` - testy obu migracji.
- Create: `src/lib/druzyna.ts` - typ `StanGlosowania` i limity długości.
- Create: `src/app/app/KartaDruzyny.tsx` - karta „Twoja drużyna” (klient).
- Modify: `src/types/db.ts` - pola `Team`.
- Modify: `src/app/app/page.tsx` - odczyt stanu i kapitanów, karta nad rankingiem.
- Modify: `src/app/app/RankingNaZywo.tsx` - skład bez punktów, korona kapitana.
- Create: `src/app/app/admin/druzyny/Glosowanie.tsx` - przyciski admina (klient).
- Modify: `src/app/app/admin/druzyny/page.tsx` - etap, postęp, przyciski.
- Modify: `src/lib/zapisy/bledy.ts` - komunikaty nowych błędów.

---

### Task 1: Baza - drużyny „Drużyna N” i głosowanie na kapitana

**Files:**
- Create: `supabase/migrations/20261009120000_druzyny_glosowanie.sql`
- Create: `tests/db/kapitan.test.ts`

**Interfaces:**
- Produces (SQL):
  - kolumny `teams.numer smallint unique` (NULL dla drużyn zakładanych ręcznie później), `teams.nazwa_nadana boolean`, `teams.glosowanie text`
  - `public.stan_glosowania() returns jsonb` → `{team_id, numer, nazwa, nazwa_nadana, etap, kapitan_id, czlonkow, glosow, moj_glos}` albo NULL bez drużyny
  - `public.oddaj_glos_na_kapitana(p_kandydat uuid) returns void`
  - `public.rozpocznij_glosowanie() returns integer` (liczba drużyn ruszonych)
  - `public.zamknij_glosowanie_teraz(p_team uuid) returns void`
  - wewnętrzna `public.zamknij_glosowanie_druzyny(p_team uuid) returns void` (bez grantów)
  - push w `powiadomienia` z `ref_type = 'kapitan'`

- [ ] **Step 1: Write the failing test** - `tests/db/kapitan.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, signIn, createUser, deleteUser, makeAdmin, type TestUser } from "../helpers/supabase";

// Własna drużyna testowa (numer 9): zasiane drużyny są współdzielone między
// plikami, a liczba członków decyduje tu o zamknięciu głosowania.
let druzyna: string;
let inna: string;
let szef: TestUser;
let szefClient: SupabaseClient;
const ludzie: { user: TestUser; client: SupabaseClient }[] = [];
let obcy: TestUser;
let obcyClient: SupabaseClient;

async function przyjmij(u: TestUser, team: string, imie: string) {
  const { error } = await admin.from("profiles").update({ status: "approved", team_id: team, display_name: imie }).eq("id", u.id);
  if (error) throw error;
}

async function resetuj() {
  await admin.from("glosy_kapitan").delete().not("voter_id", "is", null);
  await admin.from("powiadomienia").delete().in("ref_type", ["kapitan", "druzyna"]);
  await admin.from("teams").update({ glosowanie: "nie_rozpoczete", captain_id: null }).not("id", "is", null);
}

beforeAll(async () => {
  const { data: d1 } = await admin.from("teams").insert({ name: "Drużyna 9", slug: `test-kap-${Date.now()}`, numer: 9 }).select("id").single();
  const { data: d2 } = await admin.from("teams").insert({ name: "Drużyna 8", slug: `test-kap2-${Date.now()}`, numer: 8 }).select("id").single();
  druzyna = d1!.id as string;
  inna = d2!.id as string;
  for (const imie of ["Ania", "Bartek", "Celina"]) {
    const user = await createUser(`kap-${imie.toLowerCase()}`);
    await przyjmij(user, druzyna, imie);
    ludzie.push({ user, client: await signIn(user) });
  }
  obcy = await createUser("kap-obcy");
  await przyjmij(obcy, inna, "Obcy");
  obcyClient = await signIn(obcy);
  szef = await createUser("kap-szef");
  await makeAdmin(szef);
  szefClient = await signIn(szef);
});

afterEach(resetuj);

afterAll(async () => {
  for (const u of [...ludzie.map((l) => l.user), obcy, szef]) await deleteUser(u);
  await admin.from("teams").delete().in("id", [druzyna, inna]);
});

const glos = (i: number, kandydat: string) => ludzie[i].client.rpc("oddaj_glos_na_kapitana", { p_kandydat: kandydat });
const id = (i: number) => ludzie[i].user.id;

describe("drużyny przed głosowaniem", () => {
  it("zasiane drużyny mają nazwy „Drużyna N”, bez motta i kapitana", async () => {
    const { data } = await admin.from("teams").select("name, numer, motto, nazwa_nadana").not("numer", "is", null).lte("numer", 4).order("numer");
    expect(data!.map((t) => t.name)).toEqual(["Drużyna 1", "Drużyna 2", "Drużyna 3", "Drużyna 4"]);
    expect(data!.every((t) => t.motto === null && t.nazwa_nadana === false)).toBe(true);
  });

  it("przed startem nie da się głosować", async () => {
    expect((await glos(0, id(1))).error!.message).toMatch(/Glosowanie nie trwa/);
  });

  it("tylko admin rozpoczyna głosowanie; start wysyła push do drużyny", async () => {
    expect((await ludzie[0].client.rpc("rozpocznij_glosowanie")).error).not.toBeNull();
    const { error } = await szefClient.rpc("rozpocznij_glosowanie");
    expect(error).toBeNull();
    const { data } = await admin.from("powiadomienia").select("adresat, adresat_id").eq("ref_type", "kapitan").eq("adresat_id", druzyna);
    expect(data).toEqual([{ adresat: "team", adresat_id: druzyna }]);
  });
});

describe("głosowanie", () => {
  it("stan pokazuje liczby i mój głos, a nie cudze", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    const { data } = await ludzie[1].client.rpc("stan_glosowania");
    expect(data).toMatchObject({ team_id: druzyna, etap: "trwa", czlonkow: 3, glosow: 1, moj_glos: null });
    const { data: moj } = await ludzie[0].client.rpc("stan_glosowania");
    expect(moj.moj_glos).toBe(id(1));
  });

  it("uczestnik nie czyta tabeli głosów", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    const { data } = await ludzie[1].client.from("glosy_kapitan").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("głos na osobę spoza drużyny odpada", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    expect((await glos(0, obcy.id)).error!.message).toMatch(/spoza twojej druzyny/);
  });

  it("głos można zmienić; ostatni głos zamyka i wybiera kapitana", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(2));
    await glos(0, id(1));
    await glos(1, id(1));
    let { data: t } = await admin.from("teams").select("glosowanie, captain_id").eq("id", druzyna).single();
    expect(t!.glosowanie).toBe("trwa");
    await glos(2, id(2));
    ({ data: t } = await admin.from("teams").select("glosowanie, captain_id").eq("id", druzyna).single());
    expect(t).toEqual({ glosowanie: "zakonczone", captain_id: id(1) });
    const { data: push } = await admin.from("powiadomienia").select("tytul").eq("ref_type", "kapitan").eq("adresat_id", druzyna);
    expect(push!.map((p) => p.tytul)).toContain("Macie kapitana");
  });

  it("remis - kapitanem zostaje jeden z remisujących", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(0));
    await glos(1, id(1));
    await glos(2, id(2));
    const { data: t } = await admin.from("teams").select("captain_id").eq("id", druzyna).single();
    expect([id(0), id(1), id(2)]).toContain(t!.captain_id);
  });

  it("głos osoby przeniesionej do innej drużyny przestaje się liczyć", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    await admin.from("profiles").update({ team_id: inna }).eq("id", id(0));
    const { data } = await ludzie[1].client.rpc("stan_glosowania");
    expect(data).toMatchObject({ czlonkow: 2, glosow: 0 });
    await admin.from("profiles").update({ team_id: druzyna }).eq("id", id(0));
  });

  it("admin zamyka awaryjnie; bez głosów drużyna zostaje bez kapitana", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    expect((await ludzie[0].client.rpc("zamknij_glosowanie_teraz", { p_team: druzyna })).error).not.toBeNull();
    expect((await szefClient.rpc("zamknij_glosowanie_teraz", { p_team: druzyna })).error).toBeNull();
    const { data: t } = await admin.from("teams").select("glosowanie, captain_id").eq("id", druzyna).single();
    expect(t).toEqual({ glosowanie: "zakonczone", captain_id: null });
    expect((await glos(0, id(1))).error!.message).toMatch(/Glosowanie nie trwa/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/kapitan.test.ts`
Expected: FAIL (`column "numer" of relation "teams" does not exist` przy insercie w `beforeAll`).

- [ ] **Step 3: Write the migration** - `supabase/migrations/20261009120000_druzyny_glosowanie.sql`

```sql
-- ============================================================
-- Sekta Wyjazdowa — drużyny bez nazw i głosowanie na kapitana
-- ============================================================
--
-- Spec 2026-10-09-druzyny-kapitan-nazwa-design.md. `teams.name` zawsze ma
-- co pokazać („Drużyna N”, dopóki kapitan nie nada nazwy), więc ranking,
-- feed, sklepik, panele i eksport działają bez zmian.

alter table teams
  add column numer        smallint unique,
  add column nazwa_nadana boolean not null default false,
  add column glosowanie   text not null default 'nie_rozpoczete'
    check (glosowanie in ('nie_rozpoczete', 'trwa', 'zakonczone'));

-- Nazwy, motta i kapitanowie zasiani w testach znikają; kolory zostają.
with kolejnosc as (
  select id, row_number() over (order by name) as n from teams
)
update teams t set numer = k.n from kolejnosc k where t.id = k.id;

update teams
set name = 'Drużyna ' || numer, motto = null, captain_id = null,
    nazwa_nadana = false, glosowanie = 'nie_rozpoczete';

-- ---------- Głosy ----------
-- Jeden głos na osobę (klucz główny), do zmiany do zamknięcia. Tajne:
-- uczestnik nie czyta tabeli, liczby podaje stan_glosowania().
create table glosy_kapitan (
  voter_id    uuid primary key references profiles(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  kandydat_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table glosy_kapitan enable row level security;
revoke all on glosy_kapitan from anon, authenticated;

-- Głosy, które się liczą: głosujący i kandydat są nadal przyjęci i w tej
-- drużynie (ktoś przeniesiony albo odrzucony w trakcie przestaje się liczyć).
create function public.glosy_waznych(p_team uuid)
returns table (kandydat_id uuid, n bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.kandydat_id, count(*)
  from public.glosy_kapitan g
  join public.profiles v on v.id = g.voter_id and v.team_id = p_team and v.status = 'approved'
  join public.profiles k on k.id = g.kandydat_id and k.team_id = p_team and k.status = 'approved'
  where g.team_id = p_team
  group by g.kandydat_id;
$$;

revoke execute on function public.glosy_waznych(uuid) from public, anon, authenticated;

create function public.czlonkow_druzyny(p_team uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.profiles where team_id = p_team and status = 'approved';
$$;

revoke execute on function public.czlonkow_druzyny(uuid) from public, anon, authenticated;

-- ---------- Stan dla uczestnika ----------
create function public.stan_glosowania()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_t    public.teams%rowtype;
  v_moj  uuid;
begin
  select team_id into v_team from public.profiles where id = auth.uid() and status = 'approved';
  if v_team is null then
    return null;
  end if;
  select * into v_t from public.teams where id = v_team;
  select kandydat_id into v_moj from public.glosy_kapitan where voter_id = auth.uid() and team_id = v_team;
  return jsonb_build_object(
    'team_id', v_t.id,
    'numer', v_t.numer,
    'nazwa', v_t.name,
    'nazwa_nadana', v_t.nazwa_nadana,
    'etap', v_t.glosowanie,
    'kapitan_id', v_t.captain_id,
    'czlonkow', public.czlonkow_druzyny(v_team),
    'glosow', coalesce((select sum(n) from public.glosy_waznych(v_team)), 0),
    'moj_glos', v_moj
  );
end;
$$;

revoke execute on function public.stan_glosowania() from public, anon;
grant execute on function public.stan_glosowania() to authenticated;

-- ---------- Zamknięcie (wewnętrzne) ----------
-- Remis: losowanie spośród kandydatów z maksimum. Bez głosów etap się kończy,
-- a kapitana wskazuje admin ręcznie.
create function public.zamknij_glosowanie_druzyny(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kapitan uuid;
  v_imie    text;
begin
  update public.teams set glosowanie = 'zakonczone' where id = p_team and glosowanie = 'trwa';
  if not found then
    return;
  end if;

  select w.kandydat_id into v_kapitan
  from public.glosy_waznych(p_team) w
  where w.n = (select max(n) from public.glosy_waznych(p_team))
  order by random()
  limit 1;

  if v_kapitan is null then
    return;
  end if;

  update public.teams set captain_id = v_kapitan where id = p_team;
  select coalesce(display_name, 'Ktoś z drużyny') into v_imie from public.profiles where id = v_kapitan;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', p_team, 'Macie kapitana',
          v_imie || ' poprowadzi drużynę. Czas na nazwę!', '/app', 'kapitan', p_team::text);
end;
$$;

revoke execute on function public.zamknij_glosowanie_druzyny(uuid) from public, anon, authenticated;

-- ---------- Głos ----------
-- `for update` na drużynie: dwa ostatnie głosy w tej samej chwili idą po
-- kolei, więc drugi zobaczy komplet i zamknie głosowanie.
create function public.oddaj_glos_na_kapitana(p_kandydat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ja   uuid := auth.uid();
  v_team uuid;
  v_etap text;
begin
  select team_id into v_team from public.profiles where id = v_ja and status = 'approved';
  if v_team is null then
    raise exception 'Glosuja tylko przyjeci uczestnicy z druzyna';
  end if;

  select glosowanie into v_etap from public.teams where id = v_team for update;
  if v_etap is distinct from 'trwa' then
    raise exception 'Glosowanie nie trwa';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_kandydat and team_id = v_team and status = 'approved'
  ) then
    raise exception 'Kandydat spoza twojej druzyny';
  end if;

  insert into public.glosy_kapitan (voter_id, team_id, kandydat_id)
  values (v_ja, v_team, p_kandydat)
  on conflict (voter_id) do update
    set team_id = excluded.team_id, kandydat_id = excluded.kandydat_id, updated_at = now();

  if coalesce((select sum(n) from public.glosy_waznych(v_team)), 0) >= public.czlonkow_druzyny(v_team) then
    perform public.zamknij_glosowanie_druzyny(v_team);
  end if;
end;
$$;

revoke execute on function public.oddaj_glos_na_kapitana(uuid) from public, anon;
grant execute on function public.oddaj_glos_na_kapitana(uuid) to authenticated;

-- ---------- Admin ----------
create function public.rozpocznij_glosowanie()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ile integer;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin rozpoczyna glosowanie';
  end if;

  delete from public.glosy_kapitan;

  with ruszone as (
    update public.teams set glosowanie = 'trwa'
    where glosowanie = 'nie_rozpoczete'
    returning id
  ), powiadomione as (
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    select 'push', 'team', id, 'Wybierzcie kapitana',
           'Głosowanie na kapitana drużyny jest otwarte.', '/app', 'kapitan', id::text
    from ruszone
    returning 1
  )
  select count(*)::integer into v_ile from powiadomione;

  return v_ile;
end;
$$;

revoke execute on function public.rozpocznij_glosowanie() from public, anon;
grant execute on function public.rozpocznij_glosowanie() to authenticated;

create function public.zamknij_glosowanie_teraz(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin zamyka glosowanie';
  end if;
  perform public.zamknij_glosowanie_druzyny(p_team);
end;
$$;

revoke execute on function public.zamknij_glosowanie_teraz(uuid) from public, anon;
grant execute on function public.zamknij_glosowanie_teraz(uuid) to authenticated;
```

- [ ] **Step 4: Push to the test DB and run the tests**

Run: `cat supabase/.temp/project-ref` (expected `cmuyeoobmidawmyxwihk`), then `npx supabase db push --yes` and `npx vitest run tests/db/kapitan.test.ts tests/db/teams.test.ts tests/db/sklepik.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261009120000_druzyny_glosowanie.sql tests/db/kapitan.test.ts
git commit -m "Drużyny jako „Drużyna N” i głosowanie na kapitana w bazie"
```

---

### Task 2: Baza - nazwa i motto od kapitana

**Files:**
- Create: `supabase/migrations/20261009120100_druzyny_nazwa.sql`
- Modify: `tests/db/kapitan.test.ts` (nowy `describe`)

**Interfaces:**
- Consumes: kolumny z Task 1.
- Produces: `public.nadaj_nazwe_druzyny(p_nazwa text, p_motto text) returns void`, `public.odblokuj_nazwe(p_team uuid) returns void`; błędy `NAZWA_JUZ_NADANA`, `NAZWA_DLUGOSC`, `MOTTO_DLUGOSC`, `NAZWA_ZAJETA`, `Nazwe nadaje kapitan druzyny`; push `ref_type = 'druzyna'`.

- [ ] **Step 1: Write the failing test** - dopisz na końcu `tests/db/kapitan.test.ts`

```ts
describe("nazwa od kapitana", () => {
  async function zKapitanem() {
    await admin.from("teams").update({ glosowanie: "zakonczone", captain_id: id(0) }).eq("id", druzyna);
  }
  afterEach(async () => {
    await admin.from("teams").update({ name: "Drużyna 9", motto: null, nazwa_nadana: false }).eq("id", druzyna);
  });

  it("nadaje tylko kapitan", async () => {
    await zKapitanem();
    const { error } = await ludzie[1].client.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Zakon", p_motto: "" });
    expect(error!.message).toMatch(/Nazwe nadaje kapitan/);
  });

  it("kapitan nadaje raz; nazwa i motto się zapisują, drugi raz odpada", async () => {
    await zKapitanem();
    const k = ludzie[0].client;
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "  Zakon Popiołu ", p_motto: "Z prochu" })).error).toBeNull();
    const { data: t } = await admin.from("teams").select("name, motto, nazwa_nadana").eq("id", druzyna).single();
    expect(t).toEqual({ name: "Zakon Popiołu", motto: "Z prochu", nazwa_nadana: true });
    const { error } = await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Inna", p_motto: "" });
    expect(error!.message).toMatch(/NAZWA_JUZ_NADANA/);
    const { data: push } = await admin.from("powiadomienia").select("body").eq("ref_type", "druzyna").eq("adresat_id", druzyna);
    expect(push![0].body).toMatch(/Zakon Popiołu/);
  });

  it("puste, za długie i zajęte nazwy odpadają, a nazwa zostaje odblokowana", async () => {
    await zKapitanem();
    const k = ludzie[0].client;
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "   ", p_motto: "" })).error!.message).toMatch(/NAZWA_DLUGOSC/);
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "x".repeat(31), p_motto: "" })).error!.message).toMatch(/NAZWA_DLUGOSC/);
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Ok", p_motto: "m".repeat(61) })).error!.message).toMatch(/MOTTO_DLUGOSC/);
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "drużyna 8", p_motto: "" })).error!.message).toMatch(/NAZWA_ZAJETA/);
    const { data: t } = await admin.from("teams").select("nazwa_nadana").eq("id", druzyna).single();
    expect(t!.nazwa_nadana).toBe(false);
  });

  it("admin odblokowuje - wraca „Drużyna N”, kapitan może nadać od nowa", async () => {
    await zKapitanem();
    await ludzie[0].client.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Brzydka", p_motto: "" });
    expect((await ludzie[0].client.rpc("odblokuj_nazwe", { p_team: druzyna })).error).not.toBeNull();
    expect((await szefClient.rpc("odblokuj_nazwe", { p_team: druzyna })).error).toBeNull();
    const { data: t } = await admin.from("teams").select("name, motto, nazwa_nadana").eq("id", druzyna).single();
    expect(t).toEqual({ name: "Drużyna 9", motto: null, nazwa_nadana: false });
    expect((await ludzie[0].client.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Ładna", p_motto: "" })).error).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/kapitan.test.ts -t "nazwa od kapitana"`
Expected: FAIL (`Could not find the function public.nadaj_nazwe_druzyny`).

- [ ] **Step 3: Write the migration** - `supabase/migrations/20261009120100_druzyny_nazwa.sql`

```sql
-- ============================================================
-- Sekta Wyjazdowa — kapitan raz nadaje drużynie nazwę i motto
-- ============================================================
--
-- Spec 2026-10-09-druzyny-kapitan-nazwa-design.md. Nazwa 1-30 znaków, motto
-- 0-60, nazwa unikalna bez względu na wielkość liter. Po nadaniu blokada;
-- admin może odblokować nieodpowiednią nazwę (wraca „Drużyna N”).

create function public.nadaj_nazwe_druzyny(p_nazwa text, p_motto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team    uuid;
  v_nadana  boolean;
  v_nazwa   text := btrim(coalesce(p_nazwa, ''));
  v_motto   text := nullif(btrim(coalesce(p_motto, '')), '');
begin
  select id, nazwa_nadana into v_team, v_nadana
  from public.teams where captain_id = auth.uid()
  limit 1
  for update;

  if v_team is null then
    raise exception 'Nazwe nadaje kapitan druzyny';
  end if;
  if v_nadana then
    raise exception 'NAZWA_JUZ_NADANA';
  end if;
  if length(v_nazwa) < 1 or length(v_nazwa) > 30 then
    raise exception 'NAZWA_DLUGOSC';
  end if;
  if v_motto is not null and length(v_motto) > 60 then
    raise exception 'MOTTO_DLUGOSC';
  end if;
  if exists (select 1 from public.teams where id <> v_team and lower(name) = lower(v_nazwa)) then
    raise exception 'NAZWA_ZAJETA';
  end if;

  update public.teams set name = v_nazwa, motto = v_motto, nazwa_nadana = true where id = v_team;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', v_team, 'Drużyna ma nazwę',
          'Od teraz jesteście: ' || v_nazwa, '/app', 'druzyna', v_team::text);
end;
$$;

revoke execute on function public.nadaj_nazwe_druzyny(text, text) from public, anon;
grant execute on function public.nadaj_nazwe_druzyny(text, text) to authenticated;

create function public.odblokuj_nazwe(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin odblokowuje nazwe';
  end if;
  update public.teams
  set nazwa_nadana = false,
      name = coalesce('Drużyna ' || numer, name),
      motto = null
  where id = p_team;
end;
$$;

revoke execute on function public.odblokuj_nazwe(uuid) from public, anon;
grant execute on function public.odblokuj_nazwe(uuid) to authenticated;
```

- [ ] **Step 4: Push to the test DB and run the tests**

Run: `npx supabase db push --yes` then `npx vitest run tests/db/kapitan.test.ts`
Expected: PASS (wszystkie testy pliku).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261009120100_druzyny_nazwa.sql tests/db/kapitan.test.ts
git commit -m "Kapitan raz nadaje nazwę i motto, admin może odblokować"
```

---

### Task 3: Karta „Twoja drużyna” i ranking bez punktów osób

**Files:**
- Create: `src/lib/druzyna.ts`
- Create: `src/app/app/KartaDruzyny.tsx`
- Modify: `src/types/db.ts:4-11` (`Team`)
- Modify: `src/app/app/page.tsx`
- Modify: `src/app/app/RankingNaZywo.tsx`
- Modify: `src/lib/zapisy/bledy.ts`
- Test: `tests/druzyna.test.ts`

**Interfaces:**
- Consumes: `stan_glosowania()`, `oddaj_glos_na_kapitana`, `nadaj_nazwe_druzyny` (Task 1-2).
- Produces: `type StanGlosowania`, `NAZWA_MAX = 30`, `MOTTO_MAX = 60`, `function bladNazwy(nazwa: string, motto: string): string | null` w `src/lib/druzyna.ts`; komponent `KartaDruzyny({ stan, sklad, mojeId })`; `RankingNaZywo` dostaje prop `kapitanowie: Record<string, string>` (team_id → user_id).

- [ ] **Step 1: Write the failing test** - `tests/druzyna.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { bladNazwy } from "../src/lib/druzyna";
import { komunikat } from "../src/lib/zapisy/bledy";

describe("walidacja nazwy drużyny (lustro bazy)", () => {
  it("pusta i za długa nazwa, za długie motto", () => {
    expect(bladNazwy("   ", "")).toMatch(/nazwę/);
    expect(bladNazwy("x".repeat(31), "")).toMatch(/30/);
    expect(bladNazwy("Ok", "m".repeat(61))).toMatch(/60/);
    expect(bladNazwy(" Zakon ", "")).toBeNull();
  });
  it("błędy z bazy po ludzku", () => {
    expect(komunikat({ message: "NAZWA_ZAJETA" })).toMatch(/zajęta/);
    expect(komunikat({ message: "NAZWA_JUZ_NADANA" })).toMatch(/już ma nazwę/);
    expect(komunikat({ message: "Glosowanie nie trwa" })).toMatch(/nie trwa/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/druzyna.test.ts`
Expected: FAIL (`Cannot find module '../src/lib/druzyna'`).

- [ ] **Step 3: Implement** 

`src/lib/druzyna.ts`:

```ts
/** Stan z `stan_glosowania()` - dla drużyny osoby zalogowanej. */
export type StanGlosowania = {
  team_id: string;
  numer: number | null;
  nazwa: string;
  nazwa_nadana: boolean;
  etap: "nie_rozpoczete" | "trwa" | "zakonczone";
  kapitan_id: string | null;
  czlonkow: number;
  glosow: number;
  moj_glos: string | null;
};

export const NAZWA_MAX = 30;
export const MOTTO_MAX = 60;

/** Lustro reguł `nadaj_nazwe_druzyny` - podpowiedź przed wysłaniem. */
export function bladNazwy(nazwa: string, motto: string): string | null {
  const n = nazwa.trim();
  if (n.length < 1) return "Wpisz nazwę drużyny";
  if (n.length > NAZWA_MAX) return `Nazwa ma najwyżej ${NAZWA_MAX} znaków`;
  if (motto.trim().length > MOTTO_MAX) return `Motto ma najwyżej ${MOTTO_MAX} znaków`;
  return null;
}
```

`src/lib/zapisy/bledy.ts` - w `komunikat()`, przed sekcją „Kasyno”:

```ts
  // Drużyny
  if (/NAZWA_ZAJETA/.test(t)) return "Ta nazwa jest już zajęta przez inną drużynę.";
  if (/NAZWA_JUZ_NADANA/.test(t)) return "Drużyna już ma nazwę - zmienić ją może tylko organizator.";
  if (/NAZWA_DLUGOSC/.test(t)) return "Nazwa ma od 1 do 30 znaków.";
  if (/MOTTO_DLUGOSC/.test(t)) return "Motto ma najwyżej 60 znaków.";
  if (/Glosowanie nie trwa/.test(t)) return "Głosowanie nie trwa - odśwież ekran.";
  if (/Kandydat spoza/.test(t)) return "Ta osoba nie jest w Twojej drużynie.";
```

`src/types/db.ts` - `Team`:

```ts
export type Team = {
  id: string;
  name: string;
  slug: string;
  color: string;
  motto: string | null;
  captain_id: string | null;
  /** 1-4 dla zasianych drużyn, do „Drużyna N”. */
  numer: number | null;
  /** Kapitan nadał nazwę - zablokowana. */
  nazwa_nadana: boolean;
  glosowanie: "nie_rozpoczete" | "trwa" | "zakonczone";
};
```

`src/app/app/KartaDruzyny.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";
import { bladNazwy, MOTTO_MAX, NAZWA_MAX, type StanGlosowania } from "@/lib/druzyna";

export type OsobaSkladu = { user_id: string; display_name: string | null };

/**
 * „Twoja drużyna” nad rankingiem - prowadzi przez wybór kapitana i nazwę
 * (spec 2026-10-09-druzyny-kapitan-nazwa-design.md). Po nadaniu nazwy znika.
 * Wszystkie reguły pilnuje baza; tu tylko podpowiedzi i stan.
 */
export function KartaDruzyny({
  stan,
  sklad,
  mojeId,
}: {
  stan: StanGlosowania;
  sklad: OsobaSkladu[];
  mojeId: string;
}) {
  const router = useRouter();
  const [wybrany, setWybrany] = useState<string | null>(stan.moj_glos);
  const [nazwa, setNazwa] = useState("");
  const [motto, setMotto] = useState("");
  const [potwierdzenie, setPotwierdzenie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  if (stan.nazwa_nadana) return null;

  const imie = (id: string | null) => sklad.find((o) => o.user_id === id)?.display_name ?? "Ktoś z drużyny";
  const jestemKapitanem = stan.kapitan_id === mojeId;

  async function wywolaj(rpc: string, args: Record<string, unknown>) {
    if (wToku.current) return false;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc(rpc, args);
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${rpc} nie przeszło:`, { code: error.code, message: error.message });
      setBlad(komunikat(error));
      router.refresh();
      return false;
    }
    router.refresh();
    return true;
  }

  const ramka = "szklo mb-5 grid gap-3 rounded-md px-4 py-4";
  const naglowek = (
    <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dym">Twoja drużyna · {stan.nazwa}</p>
  );

  if (stan.etap === "nie_rozpoczete") {
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm text-kosc">Kapitana wybierzecie, gdy organizator otworzy głosowanie.</p>
        <p className="text-xs text-dym">Skład: {sklad.map((o) => o.display_name ?? "Uczestnik").join(", ")}</p>
      </section>
    );
  }

  if (stan.etap === "trwa") {
    const procent = stan.czlonkow > 0 ? Math.round((stan.glosow / stan.czlonkow) * 100) : 0;
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm font-bold text-kosc">Wybierzcie kapitana</p>
        <p className="text-xs text-dym">
          Głosowanie jest tajne i zamknie się samo, gdy zagłosuje cały skład. Na siebie też możesz głosować.
        </p>
        <fieldset className="grid gap-1.5">
          <legend className="sr-only">Kandydaci</legend>
          {sklad.map((o) => (
            <label key={o.user_id} className="flex min-h-11 items-center gap-3 text-sm text-kosc">
              <input
                type="radio"
                name="kapitan"
                checked={wybrany === o.user_id}
                onChange={() => setWybrany(o.user_id)}
                className="size-5 shrink-0 accent-[var(--color-krew)]"
              />
              <span>
                {o.display_name ?? "Uczestnik"}
                {o.user_id === mojeId && <span className="ml-1.5 text-xs text-dym">(Ty)</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          onClick={() => void wywolaj("oddaj_glos_na_kapitana", { p_kandydat: wybrany })}
          disabled={czeka || !wybrany || wybrany === stan.moj_glos}
        >
          {czeka ? "Zapisuję..." : stan.moj_glos ? "Zmień głos" : "Oddaj głos"}
        </Button>
        {stan.moj_glos && <p className="text-xs text-dym">Twój głos: {imie(stan.moj_glos)}.</p>}
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-krew-jasna transition-[width]" style={{ width: `${procent}%` }} />
          </div>
          <p className="mt-1 text-xs tabular-nums text-dym">
            Zagłosowało {stan.glosow} z {stan.czlonkow}
          </p>
        </div>
        {blad && <p role="alert" className="text-sm text-krew-jasna">{blad}</p>}
      </section>
    );
  }

  // zakonczone, nazwa nienadana
  if (!stan.kapitan_id) {
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm text-kosc">Głosowanie zakończone. Kapitana wskaże organizator.</p>
      </section>
    );
  }

  if (!jestemKapitanem) {
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm text-kosc">
          Kapitanem jest <b>{imie(stan.kapitan_id)}</b> - teraz wymyśla nazwę drużyny.
        </p>
      </section>
    );
  }

  const bladFormularza = bladNazwy(nazwa, motto);
  return (
    <section className={ramka}>
      {naglowek}
      <p className="text-sm font-bold text-kosc">Jesteś kapitanem - nadaj drużynie nazwę</p>
      <Field label={`Nazwa (do ${NAZWA_MAX} znaków)`} value={nazwa} maxLength={NAZWA_MAX} onChange={(e) => setNazwa(e.target.value)} />
      <Field
        label={`Motto - opcjonalnie (do ${MOTTO_MAX} znaków)`}
        value={motto}
        maxLength={MOTTO_MAX}
        onChange={(e) => setMotto(e.target.value)}
      />
      {nazwa.trim() && (
        <p className="text-xs text-dym">
          Podgląd: <b className="text-kosc">{nazwa.trim()}</b>
          {motto.trim() && <> - {motto.trim()}</>}
        </p>
      )}
      {potwierdzenie ? (
        <div className="grid gap-2">
          <p className="text-sm text-kosc">Nazwę ustawiasz raz - potem zmieni ją tylko organizator. Na pewno?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="szklo" onClick={() => setPotwierdzenie(false)} disabled={czeka}>
              Jeszcze nie
            </Button>
            <Button
              onClick={() => void wywolaj("nadaj_nazwe_druzyny", { p_nazwa: nazwa, p_motto: motto })}
              disabled={czeka}
            >
              {czeka ? "Zapisuję..." : "Tak, nadaj"}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setPotwierdzenie(true)} disabled={bladFormularza !== null}>
          Nadaj nazwę
        </Button>
      )}
      {blad && <p role="alert" className="text-sm text-krew-jasna">{blad}</p>}
    </section>
  );
}
```

`src/app/app/page.tsx` - dodaj odczyty stanu i kapitanów oraz kartę:

```tsx
import { KartaDruzyny } from "./KartaDruzyny";
import type { StanGlosowania } from "@/lib/druzyna";
// ...
  const [{ data }, { data: czlonkowie }, { data: stan }, { data: druzyny }] = await Promise.all([
    supabase.from("team_scores").select("*").order("score", { ascending: false }),
    supabase
      .from("user_scores")
      .select("user_id, display_name, team_id, score")
      .not("team_id", "is", null)
      .order("display_name"),
    supabase.rpc("stan_glosowania"),
    supabase.from("teams").select("id, captain_id"),
  ]);
  const stanGlosowania = stan as StanGlosowania | null;
  const kapitanowie = Object.fromEntries(
    ((druzyny ?? []) as { id: string; captain_id: string | null }[])
      .filter((d) => d.captain_id)
      .map((d) => [d.id, d.captain_id as string]),
  );
  const sklad = ((czlonkowie ?? []) as Czlonek[]).filter((c) => c.team_id === stanGlosowania?.team_id);
// w JSX, przed <RankingNaZywo>:
      {stanGlosowania && <KartaDruzyny stan={stanGlosowania} sklad={sklad} mojeId={user.id} />}
// i nowy prop: kapitanowie={kapitanowie}
```

`src/app/app/RankingNaZywo.tsx`:
- prop `kapitanowie: Record<string, string>`;
- w zapytaniu odświeżającym członków `.order("display_name")` zamiast po punktach;
- w wierszu składu usuń `<span className="flex-none tabular-nums">{c.score}</span>` i dodaj koronę przy kapitanie:

```tsx
{kapitanowie[w.team_id] === c.user_id && (
  <span className="ml-1.5 text-xs text-krew-jasna" aria-label="kapitan">♛</span>
)}
```

- komentarz przy liście: „Punkty osób celowo niewidoczne (decyzja 2026-10-08) - każdy widzi swoje w kasynie i w „Więcej”.”

- [ ] **Step 4: Run tests and checks**

Run: `npx vitest run tests/druzyna.test.ts && npx tsc --noEmit -p . && npx eslint src`
Expected: PASS, zero błędów.

- [ ] **Step 5: Commit**

```bash
git add src/lib/druzyna.ts src/app/app/KartaDruzyny.tsx src/types/db.ts src/app/app/page.tsx src/app/app/RankingNaZywo.tsx src/lib/zapisy/bledy.ts tests/druzyna.test.ts
git commit -m "Karta „Twoja drużyna”: głosowanie na kapitana i nazwa; ranking bez punktów osób"
```

---

### Task 4: Panel admina - start, postęp, zamknięcie, odblokowanie

**Files:**
- Create: `supabase/migrations/20261009120200_druzyny_postep.sql`
- Create: `src/app/app/admin/druzyny/Glosowanie.tsx`
- Modify: `src/app/app/admin/druzyny/page.tsx`
- Modify: `tests/db/kapitan.test.ts`

**Interfaces:**
- Consumes: `rozpocznij_glosowanie()`, `zamknij_glosowanie_teraz(p_team)`, `odblokuj_nazwe(p_team)`, `glosy_waznych`, `czlonkow_druzyny` (Task 1-2); pola `Team` (Task 3).
- Produces: `public.postep_glosowania() returns table (team_id uuid, glosow bigint, czlonkow integer)`; komponenty `StartGlosowania()` i `AkcjeDruzyny({ team, glosow, czlonkow })`.

- [ ] **Step 1: Add the admin progress function (test first)** - nowa migracja `supabase/migrations/20261009120200_druzyny_postep.sql`

```sql
-- Postęp głosowania dla panelu admina (tabela głosów jest zamknięta
-- dla wszystkich ról aplikacji, także admina - tylko liczby).
create function public.postep_glosowania()
returns table (team_id uuid, glosow bigint, czlonkow integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin';
  end if;
  return query
    select t.id,
           coalesce((select sum(w.n) from public.glosy_waznych(t.id) w), 0)::bigint,
           public.czlonkow_druzyny(t.id)
    from public.teams t;
end;
$$;

revoke execute on function public.postep_glosowania() from public, anon;
grant execute on function public.postep_glosowania() to authenticated;
```

Test (dopisz do `tests/db/kapitan.test.ts`, w `describe("głosowanie")`):

```ts
  it("admin widzi postęp, uczestnik nie", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    const { data } = await szefClient.rpc("postep_glosowania");
    expect((data as { team_id: string; glosow: number; czlonkow: number }[]).find((p) => p.team_id === druzyna)).toEqual({ team_id: druzyna, glosow: 1, czlonkow: 3 });
    expect((await ludzie[0].client.rpc("postep_glosowania")).error).not.toBeNull();
  });
```

- [ ] **Step 2: Implement** `src/app/app/admin/druzyny/Glosowanie.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { Team } from "@/types/db";

const ETAP: Record<Team["glosowanie"], string> = {
  nie_rozpoczete: "głosowanie nierozpoczęte",
  trwa: "głosowanie trwa",
  zakonczone: "głosowanie zakończone",
};

function useAkcja() {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);
  async function wykonaj(rpc: string, args?: Record<string, unknown>) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc(rpc, args);
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${rpc} nie przeszło:`, error);
      setBlad(error.message);
      return;
    }
    router.refresh();
  }
  return { blad, czeka, wykonaj };
}

/** Start wyboru kapitanów - dla wszystkich drużyn naraz, gdy składy są gotowe. */
export function StartGlosowania() {
  const { blad, czeka, wykonaj } = useAkcja();
  const [pewny, setPewny] = useState(false);
  return (
    <div className="mb-5 grid gap-2">
      {pewny ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="szklo" onClick={() => setPewny(false)} disabled={czeka}>
            Jeszcze nie
          </Button>
          <Button onClick={() => void wykonaj("rozpocznij_glosowanie")} disabled={czeka}>
            {czeka ? "Startuję..." : "Tak, start"}
          </Button>
        </div>
      ) : (
        <Button onClick={() => setPewny(true)}>Rozpocznij wybór kapitanów</Button>
      )}
      <p className="px-1 text-xs text-dym">
        Startuj, gdy składy są gotowe - głosowanie zamyka się samo, gdy zagłosuje cała drużyna.
      </p>
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}

export function AkcjeDruzyny({ team, glosow, czlonkow }: { team: Team; glosow: number; czlonkow: number }) {
  const { blad, czeka, wykonaj } = useAkcja();
  return (
    <div className="mt-2 grid gap-2">
      <p className="text-xs text-dym">
        {ETAP[team.glosowanie]}
        {team.glosowanie === "trwa" && ` · zagłosowało ${glosow} z ${czlonkow}`}
        {team.nazwa_nadana && " · nazwa nadana"}
      </p>
      <div className="flex flex-wrap gap-2">
        {team.glosowanie === "trwa" && (
          <Button variant="szklo" onClick={() => void wykonaj("zamknij_glosowanie_teraz", { p_team: team.id })} disabled={czeka}>
            Zamknij teraz
          </Button>
        )}
        {team.nazwa_nadana && (
          <Button variant="szklo" onClick={() => void wykonaj("odblokuj_nazwe", { p_team: team.id })} disabled={czeka}>
            Odblokuj nazwę
          </Button>
        )}
      </div>
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Wire into** `src/app/app/admin/druzyny/page.tsx`
  - drużyny `.order("numer", { nullsFirst: false })`;
  - dołóż `supabase.rpc("postep_glosowania")` do `Promise.all` i zbuduj mapę `team_id → { glosow, czlonkow }`;
  - nad listą: `{druzyny.every((d) => d.glosowanie === "nie_rozpoczete") && <StartGlosowania />}`;
  - w karcie drużyny pod `<WyborKapitana …/>`: `<AkcjeDruzyny team={d} glosow={postep.get(d.id)?.glosow ?? 0} czlonkow={postep.get(d.id)?.czlonkow ?? 0} />`.

- [ ] **Step 4: Run tests and checks**

Run: `npx supabase db push --yes && npx vitest run tests/db/kapitan.test.ts && npx tsc --noEmit -p . && npx eslint src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/admin/druzyny supabase/migrations/20261009120200_druzyny_postep.sql tests/db/kapitan.test.ts
git commit -m "Panel drużyn: start wyboru kapitanów, postęp, zamknięcie i odblokowanie nazwy"
```

---

### Task 5: Sprawdzenie na telefonie, pełne testy i wdrożenie

**Files:** brak zmian w kodzie (chyba że sprawdzenie coś wykaże).

- [ ] **Step 1: Phone walkthrough** - `next dev -p 3300` na bazie testowej (memory „Test e2e na telefonie”), skrypt puppeteer w scratchpadzie: drużyna testowa z 3 przyjętymi osobami; zrzuty karty w etapach `nie_rozpoczete` → (admin RPC start) `trwa` po 1 głosie → po 3 głosach (kapitan) widok kapitana z formularzem i widok członka → po nadaniu nazwy brak karty, ranking z nową nazwą i koroną; `scrollWidth == clientWidth`. Sprzątanie w `finally` (drużyna, konta, powiadomienia, reset `teams`).

- [ ] **Step 2: Full suite**

Run: `npx tsc --noEmit -p . && npx eslint src tests && npx vitest run`
Expected: wszystkie pliki PASS.

- [ ] **Step 3: Deploy** - link prod (`tjjlslupthlylnxvfroz`), `db push --dry-run` (trzy nowe migracje), `db push --yes`, relink `cmuyeoobmidawmyxwihk`; sprawdź na prod `select name, numer, glosowanie from teams order by numer` → „Drużyna 1-4”, `nie_rozpoczete`.

- [ ] **Step 4: Commit & push**

```bash
git push origin main
```
