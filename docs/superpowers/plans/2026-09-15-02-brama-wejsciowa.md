# Brama wejściowa — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć drogę od zalogowania do pełnego dostępu: formularz rejestracyjny ze zdjęciem przelewu, OCR w przeglądarce jako podpowiedź dla admina i akceptacja przypisująca drużynę.

**Architecture:** Zgłoszenie to wiersz w `registrations` plus plik w prywatnym buckecie `proofs`. Uczestnik zapisuje wyłącznie własne zgłoszenie ze statusem `pending` — RLS nie zna polityki `UPDATE` na tej tabeli, więc statusu nie zmieni nikt poza funkcją `review_registration` (`SECURITY DEFINER`), która jako jedyna dotyka `profiles.status` i `profiles.team_id`, zablokowanych grantami kolumnowymi z planu 01. OCR liczy się w przeglądarce i jest doradczy: jego awaria nie blokuje zgłoszenia.

**Tech Stack:** Next.js 16, TypeScript, Supabase (Postgres + Storage), Tesseract.js 7, browser-image-compression 2, Tailwind CSS v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-sekta-wyjazdowa-design.md` — §9 krok 2, decyzja D4, §5 („Dowody przelewu widzi wyłącznie admin"), §6 przepływ „Wejście".

**Poprzedni plan:** `docs/superpowers/plans/2026-09-15-01-fundament.md`

---

## Czego ten plan świadomie nie robi

Panel admina powstaje tu w wersji minimalnej — jedna trasa `/admin/rejestracje`
i rozdroże na `/admin`. Pełny panel, ranking na żywo i dopracowany wygląd to
plan 03. Nie inwestuj tutaj w warstwę wizualną ponad to, co daje design system
z planu 01: ten ekran i tak zostanie przerobiony.

---

## Struktura plików po tym planie

```
src/
  app/
    rejestracja/
      page.tsx                    serwerowo: czyta ostatnie zgłoszenie, wybiera widok
      FormularzRejestracji.tsx    klient: kompresja, upload, OCR, zapis
    admin/
      page.tsx                    rozdroże panelu (na razie jeden odnośnik)
      rejestracje/
        page.tsx                  serwerowo: kolejka zgłoszeń + podpisane URL-e
        PrzyciskiDecyzji.tsx      klient: wybór drużyny, akceptacja, odrzucenie
  lib/
    ocr/
      score.ts                    czysta heurystyka słów kluczowych (testowalna)
      run.ts                      uruchomienie Tesseracta w przeglądarce
    obrazy.ts                     kompresja zdjęcia przed uploadem
  types/db.ts                     + typ Registration
supabase/migrations/<ts>_brama_wejsciowa.sql
tests/
  helpers/supabase.ts             + makeAdmin, approve
  db/registrations.test.ts        RLS tabeli zgłoszeń
  db/review-registration.test.ts  funkcja rozpatrująca
  db/storage-proofs.test.ts       polityki bucketu
```

Podział OCR na dwa pliki nie jest ozdobnikiem: `score.ts` nie importuje niczego,
więc chodzi w Vitest pod Node'em. Gdyby heurystyka siedziała w tym samym pliku co
`createWorker`, test ciągnąłby za sobą 30 MB wasm i nie dałoby się go uruchomić
poza przeglądarką.

---

## Task 1: Migracja 0002 — zgłoszenia, bucket, funkcja rozpatrująca

**Files:**
- Create: `supabase/migrations/<timestamp>_brama_wejsciowa.sql`

- [ ] **Step 1: Utwórz plik migracji**

```bash
cd "/d/Projects/jwk26"
npx supabase migration new brama_wejsciowa
```

Expected: `Created new migration at supabase/migrations/20260916XXXXXX_brama_wejsciowa.sql`

Zapamiętaj wypisaną nazwę — dalsze kroki mówią o niej „plik migracji".

**Sprawdź znacznik czasu, zanim cokolwiek wpiszesz.** Musi być późniejszy niż
`20260915120000_init.sql`, a `migration new` tego nie gwarantuje: bierze bieżący
czas UTC, podczas gdy migracja 0001 dostała w planie 01 znacznik wpisany z ręki
(12:00:00), wyprzedzający realny czas. Jeśli CLI wypisze wcześniejszą nazwę,
przemianuj plik na `20260915120100_brama_wejsciowa.sql` — kolejność ma znaczenie,
bo ta migracja korzysta z typu `user_status`, tabeli `profiles` i funkcji
`public.is_admin()` z 0001.

- [ ] **Step 2: Wpisz treść migracji**

Wklej do pliku migracji:

```sql
-- ============================================================
-- Sekta Wyjazdowa — brama wejściowa
-- ============================================================

-- ---------- Zgłoszenia ----------
-- Status celowo używa typu user_status z migracji 0001: wartości są identyczne
-- ('pending' | 'approved' | 'rejected'), a drugi enum o tych samych etykietach
-- byłby wyłącznie okazją do pomyłki przy rzutowaniu.
create table registrations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  full_name         text not null,
  phone             text,
  sms_consent       boolean not null default false,
  diet_notes        text,
  proof_path        text not null,
  -- Pola ocr_* pochodzą od niezaufanego klienta i to jest w porządku: decyzja D4
  -- mówi, że OCR jest podpowiedzią, a bramką jest człowiek patrzący na oryginał.
  ocr_text          text,
  ocr_confidence    real,
  ocr_keywords_hit  integer not null default 0,
  status            user_status not null default 'pending',
  reviewed_by       uuid references profiles(id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now()
);

create index registrations_user_idx   on registrations (user_id, created_at desc);
create index registrations_status_idx on registrations (status, created_at desc);

-- ---------- RLS zgłoszeń ----------
alter table registrations enable row level security;

create policy registrations_read_own on registrations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Świeże zgłoszenie musi być własne, czekające i wskazywać na plik we własnym
-- folderze. Bez ostatniego warunku uczestnik podpiąłby pod swoje zgłoszenie
-- ścieżkę do cudzego dowodu przelewu i zobaczyłby go oczami admina.
create policy registrations_insert_own on registrations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and proof_path like ((select auth.uid())::text || '/%')
  );

-- Brak polityk UPDATE i DELETE jest zamierzony: status zmienia wyłącznie
-- review_registration. Admin też nie rusza tej tabeli zwykłym UPDATE-em.

-- ---------- Rozpatrywanie zgłoszeń ----------
-- Jedyna droga, którą profiles.status i profiles.team_id mogą się zmienić —
-- granty kolumnowe z migracji 0001 zabraniają tego nawet adminowi.
create function public.review_registration(
  p_registration_id uuid,
  p_approve         boolean,
  p_team_id         uuid default null,
  p_note            text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid;
  v_full_name text;
  v_status    public.user_status;
begin
  -- SECURITY DEFINER omija RLS, więc uprawnienie trzeba sprawdzić ręcznie.
  -- Bez tej linii dowolny zalogowany zaakceptowałby sam siebie jednym rpc().
  if not public.is_admin() then
    raise exception 'Tylko admin moze rozpatrywac zgloszenia';
  end if;

  if p_approve and p_team_id is null then
    raise exception 'Akceptacja wymaga wskazania druzyny';
  end if;

  select user_id, full_name into v_user_id, v_full_name
  from public.registrations
  where id = p_registration_id and status = 'pending'
  for update;

  if v_user_id is null then
    raise exception 'Zgloszenie nie istnieje albo zostalo juz rozpatrzone';
  end if;

  -- Rzutowanie jawne: przy search_path = '' nie ma po co liczyć na to, że
  -- literał sam trafi na właściwy typ.
  v_status := (case when p_approve then 'approved' else 'rejected' end)::public.user_status;

  update public.registrations
  set status      = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_note
  where id = p_registration_id;

  update public.profiles
  set status  = v_status,
      team_id = case when p_approve then p_team_id else team_id end,
      -- Nie nadpisujemy nazwy, którą ktoś zdążył sobie ustawić samodzielnie.
      display_name = coalesce(display_name, v_full_name)
  where id = v_user_id;
end;
$$;

revoke execute on function public.review_registration(uuid, boolean, uuid, text) from public;
grant  execute on function public.review_registration(uuid, boolean, uuid, text) to authenticated;

-- ---------- Bucket na dowody przelewu ----------
-- Bucket prywatny: dostęp wyłącznie przez podpisane URL-e generowane adminowi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Wrzucać wolno wyłącznie do folderu o nazwie własnego identyfikatora.
create policy proofs_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Czytać może wyłącznie admin — to dane finansowe. Autor zgłoszenia też nie,
-- bo swoje zdjęcie widział przed wysłaniem i nie ma po co wracać.
create policy proofs_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs' and public.is_admin());
```

- [ ] **Step 3: Zastosuj migrację w obu projektach**

```bash
cd "/d/Projects/jwk26"
npx supabase db push
```

Expected: `Applying migration ..._brama_wejsciowa.sql...` i `Finished supabase db push.`

Jeśli `db push` padnie na `must be owner of table objects`, polityki bucketu trzeba
założyć klikaniem: Supabase → **Storage → Policies → storage.objects → New policy**,
z tymi samymi warunkami `with check` i `using` co wyżej. Reszta migracji przechodzi
niezależnie. Nie usuwaj wtedy tych dwóch `create policy` z pliku — zostaw je
z komentarzem, że w tym projekcie zostały założone ręcznie, żeby kolejny projekt
(np. odtwarzany od zera) dostał je automatycznie.

Teraz projekt testowy, a na koniec powrót do głównego:

```bash
npx supabase link --project-ref <REF-PROJEKTU-JWK26-TEST>
npx supabase db push
npx supabase link --project-ref <REF-PROJEKTU-JWK26>
```

- [ ] **Step 4: Sprawdź, że bucket istnieje**

W Supabase → **Storage**: bucket `proofs` widoczny, oznaczony jako prywatny.
To samo w projekcie testowym — bez tego testy z Taska 4 nie ruszą.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "Dodaj migrację 0002: zgłoszenia, bucket na dowody, funkcję rozpatrującą"
```

---

## Task 1b: Hartowanie po przeglądzie (migracja 0003)

> Dopisane w trakcie wykonania, po przeglądzie jakości migracji 0002. Ponieważ
> 0002 była już zastosowana w obu bazach, poprawki musiały pójść osobnym plikiem:
> `supabase/migrations/20260915120200_hartowanie_bramy.sql`.

Cztery dziury, których pierwsza wersja nie zamykała:

1. **Brak limitu liczby zgłoszeń.** Polityka INSERT pilnowała treści, nie liczby —
   pętla insertów z konsoli przechodziła w całości i zasypywała kolejkę admina,
   w której każdy wiersz kosztuje osobne `createSignedUrl`. Domknięte unikalnym
   indeksem częściowym na `(user_id) where status = 'pending'`.
2. **Path traversal w `proof_path`.** `like 'uuid/%'` przepuszczał
   `uuid/../cudzy-uuid/plik.jpg`, a klient Storage normalizuje `..` przy budowaniu
   URL-a — admin oglądałby cudzy dowód podpisany nazwiskiem napastnika. Domknięte
   warunkiem `proof_path !~ '\.\.'`.
3. **`p_approve = null` po cichu odrzucało zgłoszenie.** `null and ...` daje `null`,
   czyli gałąź `else`, a `case when null` traktuje `null` jak fałsz. Literówka
   w panelu kosztowałaby kogoś wyjazd. Domknięte jawnym `raise exception`.
4. **Osoba już zaakceptowana mogła złożyć nowe zgłoszenie**, a jego odrzucenie
   zbijało jej `profiles.status` na `rejected` i wyrzucało z aplikacji. Domknięte
   warunkiem `not public.is_approved()` w polityce INSERT.

Dołożone też `check`i na pola OCR (`ocr_confidence` w 0–1, `ocr_keywords_hit`
w 0–6, `ocr_text` do 20 000 znaków) — nie po to, żeby ufać klientowi, bo bramką
jest człowiek (D4), tylko żeby panel nie wyświetlił „pewność 1e+32%" i żeby jedno
zgłoszenie nie wepchnęło megabajta tekstu do darmowej bazy.

Testy tych czterech zabezpieczeń są w Taskach 2 i 3.

---

## Task 2: Testy RLS tabeli zgłoszeń

**Files:**
- Modify: `tests/helpers/supabase.ts`
- Create: `tests/db/registrations.test.ts`

- [ ] **Step 1: Dopisz pomocniki do helpera**

Dopisz na końcu `tests/helpers/supabase.ts`:

```ts
/** Nadaje rolę admina — omija granty kolumnowe, bo idzie kluczem serwisowym. */
export async function makeAdmin(user: TestUser): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id);
  if (error) throw error;
}


/**
 * Ustawia status 'approved' bez przechodzenia przez review_registration.
 * Nazwa mówi „ustaw", nie „zaakceptuj", bo funkcja omija całą ścieżkę akceptacji:
 * klucz serwisowy nie podlega grantom kolumnowym, które blokują te pola roli
 * `authenticated`. Drużyna jest opcjonalna — bywa testowi obojętna.
 */
export async function ustawJakoZaakceptowany(
  user: TestUser,
  teamId?: string,
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ status: "approved", ...(teamId ? { team_id: teamId } : {}) })
    .eq("id", user.id);
  if (error) throw error;
}
```

Testy z planu 01 mają własne, lokalne kopie tych pomocników. Zostawiamy je
w spokoju — przepisywanie działających testów przy okazji dokładania nowych to
proszenie się o regres w miejscu, którego ten plan nie dotyczy.

- [ ] **Step 2: Napisz test RLS zgłoszeń**

Utwórz `tests/db/registrations.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  makeAdmin,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

afterEach(async () => {
  while (sprzatanie.length) {
    const user = sprzatanie.pop()!;
    // Redundantne wobec kaskady z profiles — zostawione jako polisa.
    await admin.from("registrations").delete().eq("user_id", user.id);
    await deleteUser(user);
  }
});

async function nowyUzytkownik(tag: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  return user;
}

/** Minimalne poprawne zgłoszenie dla danego użytkownika. */
function zgloszenie(user: TestUser) {
  return {
    user_id: user.id,
    full_name: "Brat Testowy",
    phone: "600100200",
    sms_consent: true,
    proof_path: `${user.id}/dowod.jpg`,
  };
}

describe("zgłoszenia rejestracyjne", () => {
  it("pozwala złożyć własne zgłoszenie", async () => {
    const user = await nowyUzytkownik("zglasza");
    const client = await signIn(user);

    const { error } = await client.from("registrations").insert(zgloszenie(user));

    expect(error).toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia w cudzym imieniu", async () => {
    const obcy = await nowyUzytkownik("ofiara");
    const sprytny = await nowyUzytkownik("podszywacz");
    const client = await signIn(sprytny);

    const { error } = await client.from("registrations").insert({
      ...zgloszenie(obcy),
      // Własna ścieżka, żeby jedynym naruszeniem był user_id. Inaczej test
      // przechodzi także po usunięciu warunku, który rzekomo pilnuje.
      proof_path: `${sprytny.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala wskazać cudzego dowodu przelewu", async () => {
    // Bez warunku na proof_path w polityce INSERT uczestnik podpiąłby pod swoje
    // zgłoszenie ścieżkę do cudzego pliku i zobaczyłby go w podglądzie admina.
    const obcy = await nowyUzytkownik("wlasciciel");
    const sprytny = await nowyUzytkownik("zerkacz");
    const client = await signIn(sprytny);

    const { error } = await client.from("registrations").insert({
      ...zgloszenie(sprytny),
      proof_path: `${obcy.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia od razu zaakceptowanego", async () => {
    const user = await nowyUzytkownik("cwaniak");
    const client = await signIn(user);

    const { error } = await client
      .from("registrations")
      .insert({ ...zgloszenie(user), status: "approved" });

    expect(error).not.toBeNull();
  });

  it("nie pokazuje cudzych zgłoszeń", async () => {
    const obcy = await nowyUzytkownik("skryty");
    const { error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenie(obcy));
    // Bez tej asercji test byłby zielony także wtedy, gdyby wiersz w ogóle nie
    // powstał — „nie widzę" nic nie znaczy, kiedy nie ma czego widzieć.
    expect(bladZapisu).toBeNull();

    const patrzacy = await nowyUzytkownik("ciekawski");
    const client = await signIn(patrzacy);

    const { data, error } = await client
      .from("registrations")
      .select("id")
      .eq("user_id", obcy.id);

    // RLS przy odczycie nie zwraca błędu, tylko pusty zbiór — asercja na error
    // niczego by tu nie złapała.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("pokazuje uczestnikowi jego własne zgłoszenie", async () => {
    const user = await nowyUzytkownik("wlasciciel-zgloszenia");
    const client = await signIn(user);

    const { error: bladZapisu } = await client
      .from("registrations")
      .insert(zgloszenie(user));
    expect(bladZapisu).toBeNull();

    // Na tym odczycie stoi cały ekran /rejestracja: to on decyduje, czy pokazać
    // poczekalnię, formularz, czy notatkę o odrzuceniu. Bez testu ten człon
    // polityki mógłby wypaść niezauważony.
    const { data } = await client.from("registrations").select("id, status");

    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("pending");
  });

  it("pokazuje adminowi wszystkie zgłoszenia", async () => {
    const zglaszajacy = await nowyUzytkownik("petent");
    const { error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenie(zglaszajacy));
    expect(bladZapisu).toBeNull();

    const szef = await nowyUzytkownik("kaplan");
    await makeAdmin(szef);
    const client = await signIn(szef);

    const { data } = await client
      .from("registrations")
      .select("id")
      .eq("user_id", zglaszajacy.id);

    expect(data).toHaveLength(1);
  });

  it("nie pozwala nikomu zmienić statusu zwykłym UPDATE-em", async () => {
    const user = await nowyUzytkownik("uparty");
    const { data: wiersz } = await admin
      .from("registrations")
      .insert(zgloszenie(user))
      .select("id")
      .single();

    const client = await signIn(user);
    const { data: poZmianie } = await client
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", wiersz!.id)
      .select();

    expect(poZmianie).toEqual([]);

    const { data: kontrola } = await admin
      .from("registrations")
      .select("status")
      .eq("id", wiersz!.id)
      .single();
    expect(kontrola!.status).toBe("pending");
  });
});

// Zabezpieczenia z migracji 20260915120200_hartowanie_bramy.sql.
describe("hartowanie bramy", () => {
  it("nie pozwala złożyć drugiego zgłoszenia, póki pierwsze czeka", async () => {
    const user = await nowyUzytkownik("zalewacz");
    const client = await signIn(user);

    const pierwsze = await client.from("registrations").insert(zgloszenie(user));
    expect(pierwsze.error).toBeNull();

    // Bez unikalnego indeksu częściowego pętla insertów z konsoli zasypałaby
    // kolejkę admina, gdzie każdy wiersz kosztuje osobne createSignedUrl.
    const drugie = await client.from("registrations").insert(zgloszenie(user));
    expect(drugie.error).not.toBeNull();
  });

  it("nie pozwala wskazać ścieżki wychodzącej z własnego folderu", async () => {
    const obcy = await nowyUzytkownik("sasiad");
    const sprytny = await nowyUzytkownik("wedrowiec");
    const client = await signIn(sprytny);

    // `like 'uuid/%'` sam w sobie to przepuszcza, a klient Storage normalizuje
    // `..` przy budowaniu URL-a — czyli trafiłoby na cudzy plik.
    const { error } = await client.from("registrations").insert({
      ...zgloszenie(sprytny),
      proof_path: `${sprytny.id}/../${obcy.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia osobie już zaakceptowanej", async () => {
    const user = await nowyUzytkownik("juz-w-srodku");
    await ustawJakoZaakceptowany(user);
    const client = await signIn(user);

    // Inaczej odrzucenie takiego zgłoszenia zbiłoby jej status na 'rejected'
    // i wyrzuciło ją z aplikacji, mimo że była już w drużynie.
    const { error } = await client.from("registrations").insert(zgloszenie(user));

    expect(error).not.toBeNull();
  });

  it("odrzuca pewność OCR spoza zakresu 0-1", async () => {
    const user = await nowyUzytkownik("fantasta");
    const client = await signIn(user);

    const { error } = await client
      .from("registrations")
      .insert({ ...zgloszenie(user), ocr_confidence: 5 });

    expect(error).not.toBeNull();
  });

  it("odrzuca liczbę trafionych słów spoza zakresu 0-6", async () => {
    const user = await nowyUzytkownik("liczykrupa");
    const client = await signIn(user);

    const { error } = await client
      .from("registrations")
      .insert({ ...zgloszenie(user), ocr_keywords_hit: 99 });

    expect(error).not.toBeNull();
  });

  it("nie pozwala nawet adminowi zmienić statusu zwykłym UPDATE-em", async () => {
    const petent = await nowyUzytkownik("podopieczny");
    const { data: wiersz, error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenie(petent))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const szef = await nowyUzytkownik("kaplan-update");
    await makeAdmin(szef);
    const client = await signIn(szef);

    // To ta połowa reguły, którą ktoś odruchowo „naprawi", dokładając
    // registrations_admin_write na wzór teams_admin_write z migracji 0001.
    // Wtedy znika gwarancja, że profiles.status zmienia się wyłącznie przez
    // review_registration.
    const { data: poZmianie } = await client
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", wiersz!.id)
      .select();

    expect(poZmianie).toEqual([]);
  });

  it("nie pozwala skasować zgłoszenia", async () => {
    const user = await nowyUzytkownik("wycofujacy");
    const client = await signIn(user);
    const { data: wiersz, error: bladZapisu } = await client
      .from("registrations")
      .insert(zgloszenie(user))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Gdyby DELETE był dozwolony, unikalny indeks na czekających zgłoszeniach
    // przestałby cokolwiek chronić: pętla delete+insert zasypuje kolejkę admina.
    const { data: poKasowaniu } = await client
      .from("registrations")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin
      .from("registrations")
      .select("id")
      .eq("id", wiersz!.id);
    expect(kontrola).toHaveLength(1);
  });

  it("pozwala złożyć zgłoszenie ponownie po odrzuceniu", async () => {
    const user = await nowyUzytkownik("druga-szansa");
    const client = await signIn(user);

    const { data: pierwsze, error: bladZapisu } = await client
      .from("registrations")
      .insert(zgloszenie(user))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Odrzucenie kluczem serwisowym — samą funkcję review_registration bada Task 3.
    await admin
      .from("registrations")
      .update({ status: "rejected" })
      .eq("id", pierwsze!.id);

    // Indeks jest częściowy (where status = 'pending'). Gdyby ktoś zapisał go
    // bez tego warunku, osoba odrzucona nigdy nie złożyłaby zgłoszenia ponownie,
    // a ekran „Ponowna próba" z Taska 7 byłby ślepą uliczką.
    const { error } = await client.from("registrations").insert(zgloszenie(user));

    expect(error).toBeNull();
  });
});
```

- [ ] **Step 3: Uruchom testy**

```bash
npm test -- tests/db/registrations.test.ts
```

Expected: `16 passed`

- [ ] **Step 4: Commit**

```bash
git add tests
git commit -m "Dodaj testy RLS zgłoszeń rejestracyjnych"
```

---

## Task 3: Testy funkcji rozpatrującej

**Files:**
- Create: `tests/db/review-registration.test.ts`

- [ ] **Step 1: Napisz testy**

Utwórz `tests/db/review-registration.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  makeAdmin,
  firstTeamId,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

afterEach(async () => {
  while (sprzatanie.length) {
    const user = sprzatanie.pop()!;
    await admin.from("registrations").delete().eq("user_id", user.id);
    await deleteUser(user);
  }
});

async function nowyUzytkownik(tag: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  return user;
}

/** Zakłada czekające zgłoszenie i zwraca jego identyfikator. */
async function zlozZgloszenie(user: TestUser): Promise<string> {
  const { data, error } = await admin
    .from("registrations")
    .insert({
      user_id: user.id,
      full_name: "Brat Testowy",
      phone: "600100200",
      sms_consent: true,
      proof_path: `${user.id}/dowod.jpg`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function nowyAdmin(tag: string) {
  const user = await nowyUzytkownik(tag);
  await makeAdmin(user);
  return user;
}

describe("rozpatrywanie zgłoszeń", () => {
  it("nie pozwala uczestnikowi zaakceptować samego siebie", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("samozwaniec");
    const zgloszenieId = await zlozZgloszenie(user);
    const client = await signIn(user);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("akceptuje zgłoszenie i przypisuje drużynę", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("petent");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });

    expect(error).toBeNull();

    const { data: profil } = await admin
      .from("profiles")
      .select("status, team_id, display_name")
      .eq("id", petent.id)
      .single();
    expect(profil!.status).toBe("approved");
    expect(profil!.team_id).toBe(teamId);
    expect(profil!.display_name).toBe("Brat Testowy");

    const { data: zgl } = await admin
      .from("registrations")
      .select("status, reviewed_by, reviewed_at")
      .eq("id", zgloszenieId)
      .single();
    expect(zgl!.status).toBe("approved");
    expect(zgl!.reviewed_by).toBe(szef.id);
    expect(zgl!.reviewed_at).not.toBeNull();
  });

  it("odmawia akceptacji bez wskazania drużyny", async () => {
    const petent = await nowyUzytkownik("bezdruzyny");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan2");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", petent.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("odrzuca zgłoszenie razem z notatką", async () => {
    const petent = await nowyUzytkownik("odrzucony");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan3");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: false,
      p_note: "Zdjęcie nieczytelne",
    });

    expect(error).toBeNull();

    const { data: zgl } = await admin
      .from("registrations")
      .select("status, review_note")
      .eq("id", zgloszenieId)
      .single();
    expect(zgl!.status).toBe("rejected");
    expect(zgl!.review_note).toBe("Zdjęcie nieczytelne");

    const { data: profil } = await admin
      .from("profiles")
      .select("status, team_id")
      .eq("id", petent.id)
      .single();
    expect(profil!.status).toBe("rejected");
    expect(profil!.team_id).toBeNull();
  });

  it("nie pozwala rozpatrzyć tego samego zgłoszenia dwa razy", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("dwukrotny");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan4");
    const client = await signIn(szef);

    const pierwsze = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });
    expect(pierwsze.error).toBeNull();

    const drugie = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: false,
      p_note: "Rozmyśliłem się",
    });
    expect(drugie.error).not.toBeNull();

    const { data } = await admin
      .from("registrations")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("approved");
  });

  it("odmawia rozpatrzenia bez decyzji", async () => {
    // Zabezpieczenie z migracji 0003: przed nim `p_approve = null` przechodziło
    // oba warunki i po cichu odrzucało zgłoszenie, bo `case when null` zachowuje
    // się jak fałsz. Literówka w panelu kosztowałaby kogoś wyjazd.
    const petent = await nowyUzytkownik("niezdecydowany");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan5");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: null,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("registrations")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("pending");
  });
});
```

- [ ] **Step 2: Uruchom testy**

```bash
npm test -- tests/db/review-registration.test.ts
```

Expected: `6 passed`

- [ ] **Step 3: Commit**

```bash
git add tests
git commit -m "Dodaj testy funkcji rozpatrującej zgłoszenia"
```

---

## Task 4: Testy polityk bucketu

Kryterium ze speca mówi wprost: dowody przelewu widzi wyłącznie admin. To dane
finansowe kolegów z samorządu — jedyny zbiór w tej apce, którego wyciek byłby
prawdziwym problemem, a nie żartem.

**Files:**
- Create: `tests/db/storage-proofs.test.ts`

- [ ] **Step 1: Napisz testy**

Utwórz `tests/db/storage-proofs.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];
const pliki: string[] = [];

afterEach(async () => {
  if (pliki.length) {
    await admin.storage.from("proofs").remove(pliki.splice(0));
  }
  while (sprzatanie.length) await deleteUser(sprzatanie.pop()!);
});

async function nowyUzytkownik(tag: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  return user;
}

/** Najmniejszy sensowny ładunek — treść nie ma znaczenia, liczy się ścieżka. */
function atrapaZdjecia(): Blob {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
    type: "image/jpeg",
  });
}

describe("bucket z dowodami przelewu", () => {
  it("pozwala wrzucić plik do własnego folderu", async () => {
    const user = await nowyUzytkownik("wrzucacz");
    const client = await signIn(user);
    const sciezka = `${user.id}/dowod.jpg`;

    const { error } = await client.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });

    expect(error).toBeNull();
    pliki.push(sciezka);
  });

  it("nie pozwala wrzucić pliku do cudzego folderu", async () => {
    const obcy = await nowyUzytkownik("wlasciciel");
    const sprytny = await nowyUzytkownik("intruz");
    const client = await signIn(sprytny);

    const { error } = await client.storage
      .from("proofs")
      .upload(`${obcy.id}/podrzucone.jpg`, atrapaZdjecia(), {
        contentType: "image/jpeg",
      });

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi pobrać cudzego dowodu", async () => {
    const obcy = await nowyUzytkownik("platnik");
    const sciezka = `${obcy.id}/dowod.jpg`;
    await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    pliki.push(sciezka);

    const ciekawski = await nowyUzytkownik("ciekawski");
    const client = await signIn(ciekawski);

    const { error } = await client.storage.from("proofs").download(sciezka);

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi pobrać nawet własnego dowodu", async () => {
    // Polityka SELECT jest wyłącznie dla admina — świadomie, zgodnie ze specem.
    // Autor widział zdjęcie przed wysłaniem i nie ma po co do niego wracać.
    const user = await nowyUzytkownik("autor");
    const sciezka = `${user.id}/dowod.jpg`;
    await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    pliki.push(sciezka);

    const client = await signIn(user);
    const { error } = await client.storage.from("proofs").download(sciezka);

    expect(error).not.toBeNull();
  });

  it("pozwala adminowi wygenerować podpisany URL", async () => {
    const platnik = await nowyUzytkownik("oplacony");
    const sciezka = `${platnik.id}/dowod.jpg`;
    await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    pliki.push(sciezka);

    const szef = await nowyUzytkownik("kaplan");
    await makeAdmin(szef);
    const client = await signIn(szef);

    const { data, error } = await client.storage
      .from("proofs")
      .createSignedUrl(sciezka, 60);

    expect(error).toBeNull();
    expect(data!.signedUrl).toContain("/proofs/");
  });
});
```

- [ ] **Step 2: Uruchom testy**

```bash
npm test -- tests/db/storage-proofs.test.ts
```

Expected: `5 passed`

Jeśli pierwszy przypadek pada z `new row violates row-level security policy`,
polityki bucketu nie zostały założone w projekcie testowym — wróć do Taska 1
Step 3 i sprawdź, czy `db push` na `jwk26-test` faktycznie przeszedł.

- [ ] **Step 3: Uruchom cały zestaw**

```bash
npm test
```

Expected: `40 passed` w sześciu plikach (13 z planu 01 + 27 z tego planu)

- [ ] **Step 4: Commit**

```bash
git add tests
git commit -m "Dodaj testy polityk bucketu z dowodami przelewu"
```

---

## Task 5: Heurystyka słów kluczowych

Jedyny kawałek OCR, który da się przetestować automatycznie — i jedyny, w którym
łatwo o cichy błąd. Dlatego powstaje przed resztą, testem naprzód.

**Files:**
- Create: `src/lib/ocr/score.ts`, `tests/ocr/score.test.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `tests/ocr/score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bezOgonkow, trafioneSlowa, SLOWA_KLUCZOWE } from "@/lib/ocr/score";

describe("bezOgonkow", () => {
  it("sprowadza polskie znaki do łacińskich", () => {
    expect(bezOgonkow("tytuł przelewu ŁÓDŹ")).toBe("tytul przelewu LODZ");
  });

  it("zostawia tekst bez ogonków bez zmian", () => {
    expect(bezOgonkow("IBAN PL61")).toBe("IBAN PL61");
  });
});

describe("trafioneSlowa", () => {
  it("znajduje słowa niezależnie od wielkości liter i ogonków", () => {
    const tekst = "Potwierdzenie PRZELEWU\nTytuł: wyjazd\nKwota 350,00 PLN";
    expect(trafioneSlowa(tekst).sort()).toEqual(
      ["kwota", "pln", "przelew", "tytul"].sort(),
    );
  });

  it("zwraca pustą listę dla tekstu bez związku z przelewem", () => {
    expect(trafioneSlowa("zdjęcie kota na parapecie")).toEqual([]);
  });

  it("zwraca pustą listę dla pustego tekstu", () => {
    expect(trafioneSlowa("")).toEqual([]);
  });

  it("nie zgłasza trafień spoza listy", () => {
    for (const slowo of trafioneSlowa("przelew iban kwota pln tytul odbiorca")) {
      expect(SLOWA_KLUCZOWE).toContain(slowo);
    }
  });
});
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

```bash
npm test -- tests/ocr/score.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/ocr/score"`

Jeśli zamiast tego widzisz `No test files found`, w `vitest.config.mts` wzorzec
`include` to `tests/**/*.test.ts` i katalog `tests/ocr/` po prostu jeszcze nie
istnieje — utwórz go razem z plikiem testu.

- [ ] **Step 3: Podepnij alias `@/` w konfiguracji Vitest**

Testy z planu 01 importowały wyłącznie po ścieżkach względnych, więc alias
`@/` nigdy nie był Vitestowi potrzebny. Teraz jest. Zastąp całą zawartość
`vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Testy dzielą jedną zdalną bazę — równoległość powodowałaby wyścigi.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

- [ ] **Step 4: Napisz implementację**

Utwórz `src/lib/ocr/score.ts`:

```ts
/**
 * Słowa, których obecność podnosi wiarygodność zdjęcia jako dowodu przelewu.
 * Zapisane bez ogonków, bo porównanie idzie na tekście po normalizacji.
 */
export const SLOWA_KLUCZOWE = [
  "przelew",
  "kwota",
  "pln",
  "tytul",
  "odbiorca",
  "iban",
] as const;

/**
 * Sprowadza polskie znaki do łacińskich odpowiedników.
 *
 * Samo NFD nie wystarcza: „ł" i „Ł" to w Unicode osobne litery, a nie „l"
 * z doklejonym znakiem diakrytycznym, więc rozkład ich nie rusza. Stąd dwa
 * jawne podstawienia po normalizacji.
 */
export function bezOgonkow(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

/** Które ze słów kluczowych wystąpiły w rozpoznanym tekście. */
export function trafioneSlowa(tekst: string): string[] {
  const znormalizowany = bezOgonkow(tekst).toLowerCase();
  return SLOWA_KLUCZOWE.filter((slowo) => znormalizowany.includes(slowo));
}
```

- [ ] **Step 5: Uruchom test i potwierdź, że przechodzi**

```bash
npm test -- tests/ocr/score.test.ts
```

Expected: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/ocr tests/ocr vitest.config.mts
git commit -m "Dodaj heurystykę słów kluczowych dla OCR"
```

---

## Task 6: OCR i kompresja w przeglądarce

**Files:**
- Create: `src/lib/ocr/run.ts`, `src/lib/obrazy.ts`
- Modify: `package.json`

- [ ] **Step 1: Zainstaluj biblioteki**

```bash
npm install tesseract.js browser-image-compression
```

Expected: `added ... packages`. W `package.json` mają wylądować `tesseract.js`
w wersji `^7` i `browser-image-compression` w `^2`.

- [ ] **Step 2: Napisz kompresję**

Utwórz `src/lib/obrazy.ts`:

```ts
/**
 * Zmniejsza zdjęcie przed uploadem. Darmowy Storage w Supabase to 1 GB,
 * a zdjęcie z aparatu telefonu potrafi ważyć 5 MB — przy 60 osobach i bingo
 * w planie 04 oryginały skończyłyby limit w jeden wieczór.
 */
export async function skompresuj(plik: File): Promise<File> {
  // Import dynamiczny: biblioteka jest wyłącznie przeglądarkowa i nie ma jej
  // po co ciągnąć do bundla, dopóki ktoś faktycznie nie wybierze pliku.
  const { default: imageCompression } = await import("browser-image-compression");

  return imageCompression(plik, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}
```

- [ ] **Step 3: Napisz uruchamianie OCR**

Utwórz `src/lib/ocr/run.ts`:

```ts
import { trafioneSlowa } from "./score";

export type WynikOcr = {
  tekst: string;
  /** Pewność Tesseracta sprowadzona do zakresu 0–1. */
  pewnosc: number;
  trafienia: string[];
};

/**
 * Czyta zdjęcie dowodu przelewu w przeglądarce.
 *
 * Zwraca `null`, gdy cokolwiek pójdzie nie tak — i to jest celowe. Decyzja D4
 * ze speca mówi, że OCR jest podpowiedzią dla admina, a nie sędzią; awaria
 * rozpoznawania nie może zablokować komuś wejścia na wyjazd.
 */
export async function przeczytajDowod(plik: File): Promise<WynikOcr | null> {
  // Import dynamiczny trzyma kilkadziesiąt megabajtów wasm poza wejściowym
  // bundlem — pobierają się dopiero przy wysyłce formularza.
  const { createWorker } = await import("tesseract.js");

  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    // Polski model: potwierdzenia przelewów z polskich banków są po polsku.
    worker = await createWorker("pol");
    const { data } = await worker.recognize(plik);
    return {
      tekst: data.text,
      pewnosc: data.confidence / 100,
      trafienia: trafioneSlowa(data.text),
    };
  } catch {
    return null;
  } finally {
    await worker?.terminate();
  }
}
```

- [ ] **Step 4: Sprawdź kompilację**

```bash
npx tsc --noEmit
```

Expected: brak wyjścia

- [ ] **Step 5: Commit**

```bash
git add src/lib package.json package-lock.json
git commit -m "Dodaj OCR w przeglądarce i kompresję zdjęć"
```

---

## Task 7: Formularz rejestracyjny

**Files:**
- Modify: `src/types/db.ts`
- Modify: `src/app/rejestracja/page.tsx`
- Create: `src/app/rejestracja/FormularzRejestracji.tsx`

- [ ] **Step 1: Dopisz typ zgłoszenia**

Dopisz na końcu `src/types/db.ts`:

```ts
export type Registration = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  sms_consent: boolean;
  diet_notes: string | null;
  proof_path: string;
  ocr_text: string | null;
  ocr_confidence: number | null;
  ocr_keywords_hit: number;
  status: UserStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};
```

- [ ] **Step 2: Napisz formularz**

Utwórz `src/app/rejestracja/FormularzRejestracji.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { przeczytajDowod } from "@/lib/ocr/run";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function FormularzRejestracji() {
  const router = useRouter();

  const [imieNazwisko, setImieNazwisko] = useState("");
  const [telefon, setTelefon] = useState("");
  const [zgodaSms, setZgodaSms] = useState(true);
  const [dieta, setDieta] = useState("");
  const [plik, setPlik] = useState<File | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [etap, setEtap] = useState<string | null>(null);

  const czeka = etap !== null;

  async function wyslij() {
    setBlad(null);

    if (imieNazwisko.trim().length < 3) {
      setBlad("Podaj imię i nazwisko");
      return;
    }
    if (!plik) {
      setBlad("Dołącz zdjęcie potwierdzenia przelewu");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBlad("Sesja wygasła — zaloguj się ponownie");
      return;
    }

    try {
      setEtap("Przygotowuję zdjęcie...");
      const zmniejszone = await skompresuj(plik);

      setEtap("Wysyłam dowód...");
      // Nazwa pliku od losowego UUID: dwa zgłoszenia tej samej osoby nie mogą
      // się nadpisać, a upload bez `upsert` i tak odmówiłby przy kolizji.
      const sciezka = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: bladUploadu } = await supabase.storage
        .from("proofs")
        .upload(sciezka, zmniejszone, { contentType: "image/jpeg" });
      if (bladUploadu) throw bladUploadu;

      setEtap("Odczytuję przelew...");
      const ocr = await przeczytajDowod(zmniejszone);

      setEtap("Zapisuję zgłoszenie...");
      const { error: bladProfilu } = await supabase
        .from("profiles")
        .update({
          display_name: imieNazwisko.trim(),
          phone: telefon.trim() || null,
          sms_consent: zgodaSms,
        })
        .eq("id", user.id);
      if (bladProfilu) throw bladProfilu;

      const { error: bladZgloszenia } = await supabase
        .from("registrations")
        .insert({
          user_id: user.id,
          full_name: imieNazwisko.trim(),
          phone: telefon.trim() || null,
          sms_consent: zgodaSms,
          diet_notes: dieta.trim() || null,
          proof_path: sciezka,
          ocr_text: ocr?.tekst ?? null,
          ocr_confidence: ocr?.pewnosc ?? null,
          ocr_keywords_hit: ocr?.trafienia.length ?? 0,
        });
      if (bladZgloszenia) throw bladZgloszenia;

      router.refresh();
    } catch (e) {
      setBlad(e instanceof Error ? e.message : "Coś poszło nie tak");
      setEtap(null);
    }
  }

  return (
    <div className="grid gap-5">
      <Field
        label="Imię i nazwisko"
        autoComplete="name"
        placeholder="Jan Kowalski"
        value={imieNazwisko}
        onChange={(e) => setImieNazwisko(e.target.value)}
      />

      <Field
        label="Telefon"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="600 100 200"
        value={telefon}
        onChange={(e) => setTelefon(e.target.value)}
      />

      <label className="flex items-start gap-3 text-sm text-smoke">
        <input
          type="checkbox"
          checked={zgodaSms}
          onChange={(e) => setZgodaSms(e.target.checked)}
          className="mt-1 size-5 accent-[var(--color-candle)]"
        />
        <span>Zgadzam się na SMS-y z komunikatami organizacyjnymi</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block font-display text-xs uppercase tracking-widest text-smoke">
          Dieta i uwagi
        </span>
        <textarea
          rows={3}
          value={dieta}
          onChange={(e) => setDieta(e.target.value)}
          placeholder="wegetarianizm, alergie, cokolwiek ważnego"
          className="w-full rounded-sm border border-candle/25 bg-ash px-3 py-2
                     text-parchment outline-none placeholder:text-smoke/60
                     focus:border-candle"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block font-display text-xs uppercase tracking-widest text-smoke">
          Potwierdzenie przelewu
        </span>
        <input
          type="file"
          accept="image/*"
          // `capture` podpowiada telefonowi aparat zamiast galerii — większość
          // osób i tak robi zdjęcie ekranu bankowości w momencie wypełniania.
          capture="environment"
          onChange={(e) => setPlik(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-smoke
                     file:mr-3 file:min-h-11 file:rounded-sm file:border-0
                     file:bg-candle file:px-4 file:font-display file:text-xs
                     file:uppercase file:tracking-widest file:text-void"
        />
        {plik && (
          <span className="mt-1.5 block text-sm text-smoke">
            {plik.name} ({Math.round(plik.size / 1024)} kB)
          </span>
        )}
      </label>

      {blad && <p className="text-sm text-blood">{blad}</p>}

      <Button onClick={wyslij} disabled={czeka}>
        {etap ?? "Złóż ofiarę"}
      </Button>

      <p className="text-center text-xs leading-relaxed text-smoke">
        Odczyt przelewu dzieje się na twoim telefonie i może chwilę potrwać.
        Zdjęcie widzi wyłącznie organizator.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Przepisz stronę rejestracji**

Zastąp całą zawartość `src/app/rejestracja/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { RitualFrame } from "@/components/RitualFrame";
import { Button } from "@/components/ui/Button";
import { FormularzRejestracji } from "./FormularzRejestracji";
import type { Registration } from "@/types/db";

export default async function RejestracjaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS i tak przepuszcza wyłącznie własne zgłoszenia, ale filtr po user_id
  // zostawia zapytaniu indeks do wykorzystania.
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ostatnie = data as Registration | null;

  if (ostatnie?.status === "pending") {
    return (
      <RitualFrame title="Próba">
        <p className="text-center leading-relaxed text-smoke">
          Twoja ofiara została złożona. Czekaj na wyrok Kapłana.
        </p>
        <Wyloguj />
      </RitualFrame>
    );
  }

  return (
    <RitualFrame title={ostatnie ? "Ponowna próba" : "Próba"}>
      {ostatnie?.status === "rejected" && (
        <div className="mb-6 border-l-4 border-blood bg-ash/60 px-4 py-3">
          <p className="font-display text-xs uppercase tracking-widest text-blood">
            Odrzucono
          </p>
          <p className="mt-1 text-sm text-smoke">
            {ostatnie.review_note ?? "Bez podania powodu."}
          </p>
        </div>
      )}

      <FormularzRejestracji />
      <Wyloguj />
    </RitualFrame>
  );
}

function Wyloguj() {
  return (
    <form action="/auth/signout" method="post" className="mt-10">
      <Button variant="ghost" type="submit" className="w-full">
        Wyloguj
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Sprawdź kompilację i build**

```bash
npx tsc --noEmit && npm run build
```

Expected: brak wyjścia z `tsc`, potem `Compiled successfully` oraz linia
`ƒ Proxy (Middleware)` pod tabelą tras.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Dodaj formularz rejestracyjny z OCR i uploadem dowodu"
```

---

## Task 8: Kolejka zgłoszeń w panelu admina

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/rejestracje/page.tsx`, `src/app/admin/rejestracje/PrzyciskiDecyzji.tsx`

- [ ] **Step 1: Napisz przyciski decyzji**

Utwórz `src/app/admin/rejestracje/PrzyciskiDecyzji.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { Team } from "@/types/db";

export function PrzyciskiDecyzji({
  zgloszenieId,
  druzyny,
}: {
  zgloszenieId: string;
  druzyny: Team[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(druzyny[0]?.id ?? "");
  const [notatka, setNotatka] = useState("");
  const [czeka, setCzeka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function rozpatrz(akceptuj: boolean) {
    setBlad(null);
    setCzeka(true);
    const { error } = await createClient().rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: akceptuj,
      p_team_id: akceptuj ? teamId : null,
      p_note: notatka.trim() || null,
    });
    setCzeka(false);
    if (error) {
      setBlad(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 grid gap-3">
      <label className="block">
        <span className="mb-1.5 block font-display text-xs uppercase tracking-widest text-smoke">
          Drużyna
        </span>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="min-h-11 w-full rounded-sm border border-candle/25 bg-ash px-3
                     text-parchment outline-none focus:border-candle"
        >
          {druzyny.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <input
        value={notatka}
        onChange={(e) => setNotatka(e.target.value)}
        placeholder="Notatka (widoczna przy odrzuceniu)"
        className="min-h-11 w-full rounded-sm border border-candle/25 bg-ash px-3
                   text-parchment outline-none placeholder:text-smoke/60
                   focus:border-candle"
      />

      {blad && <p className="text-sm text-blood">{blad}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => rozpatrz(true)} disabled={czeka || !teamId}>
          Przyjmij
        </Button>
        <Button variant="danger" onClick={() => rozpatrz(false)} disabled={czeka}>
          Odrzuć
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Napisz stronę kolejki**

Utwórz `src/app/admin/rejestracje/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { RitualFrame } from "@/components/RitualFrame";
import { PrzyciskiDecyzji } from "./PrzyciskiDecyzji";
import type { Registration, Team } from "@/types/db";

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną (w tabeli tras wyjdzie jako `ƒ`). W Next 16 ta opcja
// i tak znika, gdy włączone są Cache Components.
export default async function KolejkaRejestracji() {
  const supabase = await createClient();

  const [{ data: zgloszeniaRaw }, { data: druzynyRaw }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("*").order("name"),
  ]);

  const zgloszenia = (zgloszeniaRaw ?? []) as Registration[];
  const druzyny = (druzynyRaw ?? []) as Team[];

  // Podpisane URL-e powstają przy renderze i żyją godzinę. Bucket jest prywatny,
  // więc bez nich obrazek nie ma jak się załadować.
  const podglady = new Map<string, string>();
  for (const z of zgloszenia) {
    const { data } = await supabase.storage
      .from("proofs")
      .createSignedUrl(z.proof_path, 3600);
    if (data?.signedUrl) podglady.set(z.id, data.signedUrl);
  }

  return (
    <RitualFrame title="Zgłoszenia">
      {zgloszenia.length === 0 && (
        <p className="text-center text-smoke">Kolejka pusta.</p>
      )}

      <ul className="grid gap-8">
        {zgloszenia.map((z) => (
          <li key={z.id} className="border border-candle/20 bg-ash/40 p-4">
            <p className="font-display tracking-wider text-candle">{z.full_name}</p>
            <p className="text-sm text-smoke">{z.phone ?? "bez telefonu"}</p>
            {z.diet_notes && (
              <p className="mt-2 text-sm text-parchment">Dieta: {z.diet_notes}</p>
            )}

            {/* Zwykły <img>, nie next/image: podpisany URL wygasa po godzinie,
                więc optymalizator i tak nie miałby czego cache'ować. Dyrektywa
                ESLint musi stać w jednej linii bezpośrednio nad znacznikiem. */}
            {podglady.has(z.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={podglady.get(z.id)}
                alt={`Dowód przelewu — ${z.full_name}`}
                className="mt-3 w-full border border-candle/20"
              />
            ) : (
              <p className="mt-3 text-sm text-blood">Nie udało się wczytać zdjęcia.</p>
            )}

            <p className="mt-3 text-xs text-smoke">
              OCR: {z.ocr_keywords_hit} słów kluczowych
              {z.ocr_confidence !== null &&
                `, pewność ${Math.round(z.ocr_confidence * 100)}%`}
            </p>
            {z.ocr_text && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-smoke">
                  Odczytany tekst
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-smoke">
                  {z.ocr_text}
                </pre>
              </details>
            )}

            <PrzyciskiDecyzji zgloszenieId={z.id} druzyny={druzyny} />
          </li>
        ))}
      </ul>
    </RitualFrame>
  );
}
```

- [ ] **Step 3: Napisz rozdroże panelu**

Bramka z planu 01 wpuszcza admina na `/admin/*`, ale samo `/admin` nie istnieje
i kończy się 404. Pełny panel to plan 03 — tu wystarczy jeden odnośnik.

Utwórz `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { RitualFrame } from "@/components/RitualFrame";

export default function AdminPage() {
  return (
    <RitualFrame title="Sanktuarium">
      <nav className="grid gap-3">
        <Link
          href="/admin/rejestracje"
          className="flex min-h-11 items-center border border-candle/40 px-4
                     font-display text-sm uppercase tracking-widest text-candle
                     hover:bg-candle/10"
        >
          Zgłoszenia
        </Link>
      </nav>
    </RitualFrame>
  );
}
```

- [ ] **Step 4: Sprawdź kompilację i build**

```bash
npx tsc --noEmit && npm run build
```

Expected: brak wyjścia z `tsc`, potem `Compiled successfully`. W tabeli tras mają
się pojawić `ƒ /admin` oraz `ƒ /admin/rejestracje`.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Dodaj kolejkę zgłoszeń w panelu admina"
```

---

## Task 9: Weryfikacja przepływu i wdrożenie

- [ ] **Step 1: Uruchom cały zestaw testów**

```bash
npm test
```

Expected: `46 passed` w siedmiu plikach

- [ ] **Step 2: Przejdź pełną ścieżkę lokalnie**

```bash
npm run dev
```

Konto admina masz z planu 01. Żeby przejść ścieżkę uczestnika, potrzebujesz
drugiego konta — a wbudowany mailer Supabase wysyła wyłącznie na adresy członków
zespołu projektu (patrz README, sekcja „Logowanie"). Jeśli custom SMTP jeszcze
nie stoi, załóż konto testowe kluczem serwisowym:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
c.auth.admin.createUser({ email: 'proba.wejscia@samorzad.ue.wroc.pl', password: 'proba-2026', email_confirm: true })
  .then(r => console.log(r.error ?? 'konto gotowe'));
"
```

Logowanie hasłem działa tylko wtedy, gdy w projekcie głównym włączony jest provider
e-mail z hasłem. Jeśli nie jest — pomiń ten wariant i przejdź ścieżkę na własnym
koncie, cofając sobie status w SQL Editorze:

```sql
update profiles set status = 'pending', team_id = null
where email = 'twoj.adres@samorzad.ue.wroc.pl';
```

Na `http://localhost:3000` sprawdź kolejno:

1. Konto ze statusem `pending` ląduje na `/rejestracja` i widzi formularz.
2. Wysyłka bez zdjęcia → komunikat „Dołącz zdjęcie potwierdzenia przelewu".
3. Wysyłka ze zdjęciem przelewu → przyciski przechodzą przez etapy i strona
   zmienia się w „Czekaj na wyrok Kapłana".
4. Próba wejścia na `/` → wraca na `/rejestracja`.
5. Na koncie admina `/admin/rejestracje` pokazuje zgłoszenie, czytelne zdjęcie
   i liczbę trafionych słów kluczowych.
6. „Odrzuć" z notatką → uczestnik widzi notatkę i może złożyć zgłoszenie ponownie.
7. „Przyjmij" z drużyną → uczestnik ląduje na `/` z rankingiem.
8. Konto bez roli admina wpisujące `/admin/rejestracje` wraca na `/`.

Zatrzymaj serwer.

- [ ] **Step 3: Sprawdź OCR na prawdziwym zdjęciu**

Punkt, który łatwo przeoczyć: przy pierwszym uruchomieniu Tesseract dociąga model
języka polskiego z CDN-u, co przy słabym zasięgu trwa. Zrób zdjęcie prawdziwego
potwierdzenia przelewu z bankowości mobilnej i sprawdź w panelu, czy liczba
trafionych słów jest większa od zera.

Jeśli wynosi zero mimo czytelnego zdjęcia, nie naprawiaj tego kodem — sprawdź
w rozwiniętym „Odczytany tekst", co Tesseract w ogóle zobaczył. Zgodnie z D4 OCR
jest podpowiedzią; zero trafień nie blokuje zgłoszenia, a admin i tak patrzy na
oryginał.

- [ ] **Step 4: Wdróż**

```bash
npx vercel --prod
```

Expected: adres produkcyjny w wyjściu, `readyState: "READY"`

- [ ] **Step 5: Sprawdź produkcję z telefonu**

Wejdź telefonem na adres produkcyjny i zrób zdjęcie przelewu bezpośrednio
z formularza — inaczej nie sprawdzisz tego, na czym ta trasa stoi: czy `capture`
otwiera aparat, czy kompresja daje sobie radę ze zdjęciem 12 Mpix i czy OCR nie
zabija zakładki na telefonie sprzed czterech lat.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Domknij bramę wejściową"
git push origin main
```

---

## Stan po tym planie

Działa: pełna droga od kodu OTP do rankingu — formularz ze zdjęciem przelewu,
kompresja i OCR w przeglądarce, prywatny bucket widoczny wyłącznie dla admina,
akceptacja przypisująca drużynę przez funkcję `SECURITY DEFINER`, kolejka
zgłoszeń w panelu. 46 testów pilnujących RLS, funkcji rozpatrującej i polityk
bucketu.

Nie działa jeszcze: ranking na żywo i pełny panel admina (plan 03), bingo (04),
sklepik (05), kasyno (06), gossipy (07), powiadomienia (08).

Ranking na `/` wciąż pokazuje same zera — pierwsze punkty pojawiają się dopiero
z planem 04.

**Warunek wstępny dla prawdziwych uczestników:** dopóki nie stoi custom SMTP,
kody OTP docierają wyłącznie do członków zespołu projektu Supabase. Brama
wejściowa może być skończona, a i tak nikt poza tobą nie wejdzie.
