import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  daneZapisu,
  ustawPule,
  ustawUstawienie,
  signIn,
  type TestUser,
} from "../helpers/supabase";

// Szturm na zapisy jak o 12:00: kilkadziesiąt osób naraz, podwójne stuknięcia,
// zamknięcie tury w trakcie, dwóch adminów nad jednym zgłoszeniem.
//
// Poza zwykłym przebiegiem (OBCIAZENIE=1 npx vitest run tests/db/obciazenie):
// projekt testowy wpuszcza ok. 30 logowań na 5 minut, a ten plik potrzebuje
// ponad 50 sesji - w pełnym zestawie wyczerpałby limit kolejnym plikom.

const LICZBA = 50;
const MIEJSCA = 40;

const url = process.env.TEST_SUPABASE_URL!;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY!;

type Osoba = { user: TestUser; klient: SupabaseClient };
let osoby: Osoba[] = [];
let szefowie: Osoba[] = [];
let druzyny: string[] = [];
let wszystkieKonta: TestUser[] = [];
const start = new Date().toISOString();

/**
 * Sesja bez logowania hasłem: link logowania wygenerowany kluczem serwisowym
 * i potwierdzony jak kod z maila. Inny licznik limitu niż logowanie hasłem.
 */
async function sesjaZLinku(user: TestUser): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error) throw error;
  const klient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await klient.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (e2) throw e2;
  return klient;
}

/**
 * Sesja mimo limitów projektu testowego: na zmianę hasłem i linkiem (osobne
 * liczniki), a gdy oba odmawiają - przerwa i ponowienie.
 */
async function sesja(user: TestUser, i: number): Promise<SupabaseClient> {
  const sposoby = i % 2 === 0 ? [signIn, sesjaZLinku] : [sesjaZLinku, signIn];
  for (let proba = 0; proba < 60; proba++) {
    for (const sposob of sposoby) {
      try {
        return await sposob(user);
      } catch (e) {
        if (!/rate limit/i.test(String((e as Error).message))) throw e;
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Limit logowań nie puścił przez 5 minut");
}

function zloz(o: Osoba, naRezerwe = false) {
  return o.klient.rpc("zloz_zgloszenie", {
    p_dane: daneZapisu({ ksywka: `Szturm ${o.user.id.slice(0, 6)}` }),
    p_wrazliwe: null,
    p_proof_path: `${o.user.id}/dowod.jpg`,
    p_na_rezerwe: naRezerwe,
  });
}

async function ileZgloszen(filtr: { rezerwa?: boolean } = {}) {
  let q = admin
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .in("user_id", osoby.map((o) => o.user.id));
  if (filtr.rezerwa !== undefined) q = q.eq("rezerwa", filtr.rezerwa);
  const { count } = await q;
  return count ?? 0;
}

describe.runIf(process.env.OBCIAZENIE === "1")("szturm na zapisy", () => {
  beforeAll(async () => {
    druzyny = await idDruzyn();
    const konta = await Promise.all(
      Array.from({ length: LICZBA + 2 }, (_, i) => createUser(`szturm-${i}`)),
    );
    // Konta trafiają do listy przed logowaniem - afterAll posprząta je nawet
    // wtedy, gdy logowanie w połowie padnie.
    wszystkieKonta = konta;
    // Sesje po kolei: sam szturm ma być równoczesny, logowanie - nie.
    const klienci: SupabaseClient[] = [];
    for (const [i, k] of konta.entries()) klienci.push(await sesja(k, i));
    osoby = konta.slice(0, LICZBA).map((user, i) => ({ user, klient: klienci[i] }));
    szefowie = konta.slice(LICZBA).map((user, i) => ({ user, klient: klienci[LICZBA + i] }));
    await Promise.all(szefowie.map((s) => makeAdmin(s.user)));
    await ustawUstawienie("regulamin_zatwierdzony", true);
  }, 600_000);

  afterEach(async () => {
    await admin.from("registrations").delete().in("user_id", osoby.map((o) => o.user.id));
    await admin
      .from("profiles")
      .update({ status: "pending", team_id: null })
      .in("id", osoby.map((o) => o.user.id));
  });

  afterAll(async () => {
    for (const k of ["dzialacze", "swiezaki", "alumni"]) await ustawPule(k, false, 0);
    await ustawUstawienie("regulamin_zatwierdzony", false);
    await admin.from("registrations").delete().in("user_id", wszystkieKonta.map((k) => k.id));
    await Promise.all(wszystkieKonta.map(deleteUser));
  }, 120_000);

  it(`${LICZBA} osób naraz na ${MIEJSCA} miejsc: dokładnie ${MIEJSCA} wchodzi, reszta na rezerwę`, async () => {
    await ustawPule("dzialacze", true, MIEJSCA);

    const t0 = Date.now();
    const czasy: number[] = [];
    const wyniki = await Promise.all(
      osoby.map(async (o) => {
        const t = Date.now();
        const r = await zloz(o);
        czasy.push(Date.now() - t);
        return r;
      }),
    );
    const calosc = Date.now() - t0;
    czasy.sort((a, b) => a - b);
    console.log(
      `szturm: ${LICZBA} zgłoszeń w ${calosc} ms; mediana ${czasy[Math.floor(czasy.length / 2)]} ms, ` +
        `p95 ${czasy[Math.floor(czasy.length * 0.95)]} ms, najdłużej ${czasy.at(-1)} ms`,
    );

    const udane = wyniki.filter((r) => r.error === null);
    const odbite = wyniki.filter((r) => r.error !== null);
    expect(udane).toHaveLength(MIEJSCA);
    // Jedyny dopuszczalny błąd: pula pełna. Żadnych zakleszczeń, timeoutów, 500.
    expect(odbite.map((r) => r.error!.message)).toEqual(Array(LICZBA - MIEJSCA).fill("PULA_PELNA"));
    expect(await ileZgloszen({ rezerwa: false })).toBe(MIEJSCA);

    // Mail „tura zapełniona” poszedł dokładnie raz.
    const { count: pelna } = await admin
      .from("maile_zgloszen_log")
      .select("id", { count: "exact", head: true })
      .eq("rodzaj", "pula_pelna")
      .eq("pula", "dzialacze")
      .gte("created_at", start);
    expect(pelna).toBe(1);

    // Odbici zapisują się na rezerwę - też naraz.
    const odbiciIdx = wyniki.map((r, i) => (r.error ? i : -1)).filter((i) => i >= 0);
    const rezerwa = await Promise.all(odbiciIdx.map((i) => zloz(osoby[i], true)));
    expect(rezerwa.filter((r) => r.error)).toEqual([]);

    const { data: kolejka } = await admin
      .from("registrations")
      .select("kolejnosc_rezerwy")
      .eq("rezerwa", true)
      .in("user_id", osoby.map((o) => o.user.id))
      .order("kolejnosc_rezerwy");
    const numery = kolejka!.map((k) => k.kolejnosc_rezerwy as number);
    // Bez dziur i bez powtórek: kolejne liczby.
    expect(numery).toHaveLength(LICZBA - MIEJSCA);
    expect(numery).toEqual(numery.map((_, i) => numery[0] + i));
    expect(await ileZgloszen({ rezerwa: false })).toBe(MIEJSCA);
  }, 120_000);

  it("pięć stuknięć tej samej osoby naraz (dwa telefony, podwójny klik) = jedno zgłoszenie", async () => {
    await ustawPule("dzialacze", true, MIEJSCA);
    const o = osoby[0];
    const wyniki = await Promise.all(Array.from({ length: 5 }, () => zloz(o)));
    expect(wyniki.filter((r) => r.error === null)).toHaveLength(1);
    // Formularz traktuje ten błąd jak sukces (zapis już jest) - patrz Formularz.tsx.
    for (const r of wyniki.filter((r) => r.error)) {
      expect(r.error!.message).toMatch(/one_pending|duplicate key/);
    }
    const { count } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", o.user.id);
    expect(count).toBe(1);
  });

  it("zamknięcie tury w trakcie szturmu: każdy dostaje zapis albo PULA_ZAMKNIETA", async () => {
    await ustawPule("dzialacze", true, 100);
    const grupa = osoby.slice(0, 30);
    const [wyniki] = await Promise.all([
      Promise.all(grupa.map((o) => zloz(o))),
      new Promise((r) => setTimeout(r, 40)).then(() => ustawPule("dzialacze", false, 100)),
    ]);
    const udane = wyniki.filter((r) => r.error === null).length;
    for (const r of wyniki.filter((r) => r.error)) expect(r.error!.message).toBe("PULA_ZAMKNIETA");
    console.log(`zamknięcie w trakcie: ${udane} zdążyło, ${grupa.length - udane} odbitych`);
    expect(await ileZgloszen()).toBe(udane);

    // Po zamknięciu nikt już nie wejdzie.
    const spozniony = osoby[40];
    expect((await zloz(spozniony)).error!.message).toBe("PULA_ZAMKNIETA");
  });

  it("dwóch adminów przyjmuje to samo zgłoszenie naraz: jedno przyjęcie, jedno powiadomienie", async () => {
    await ustawPule("dzialacze", true, MIEJSCA);
    const o = osoby[1];
    const { data: zgl, error } = await zloz(o);
    expect(error).toBeNull();
    const id = (zgl as { id: string }).id;

    const wyniki = await Promise.all(
      szefowie.map((s, i) =>
        s.klient.rpc("review_registration", { p_registration_id: id, p_approve: true, p_team_id: druzyny[i] }),
      ),
    );
    const ok = wyniki.filter((r) => r.error === null);
    expect(ok).toHaveLength(1);
    expect(wyniki.find((r) => r.error)!.error!.message).toMatch(/juz rozpatrzone/);

    const { count: push } = await admin
      .from("powiadomienia")
      .select("id", { count: "exact", head: true })
      .eq("ref_type", "registration")
      .eq("ref_id", id);
    expect(push).toBe(1);

    const { data: p } = await admin.from("profiles").select("status, team_id").eq("id", o.user.id).single();
    expect(p!.status).toBe("approved");
    expect(druzyny.slice(0, 2)).toContain(p!.team_id);
  });

  it("przyjęcie i odrzucenie naraz: wygrywa jedna decyzja, profil zgodny ze zgłoszeniem", async () => {
    await ustawPule("dzialacze", true, MIEJSCA);
    const o = osoby[2];
    const { data: zgl } = await zloz(o);
    const id = (zgl as { id: string }).id;

    const [tak, nie] = await Promise.all([
      szefowie[0].klient.rpc("review_registration", { p_registration_id: id, p_approve: true, p_team_id: druzyny[0] }),
      szefowie[1].klient.rpc("review_registration", { p_registration_id: id, p_approve: false, p_note: "test" }),
    ]);
    expect([tak.error, nie.error].filter(Boolean)).toHaveLength(1);

    const { data: z } = await admin.from("registrations").select("status").eq("id", id).single();
    const { data: p } = await admin.from("profiles").select("status").eq("id", o.user.id).single();
    expect(z!.status).toBe(tak.error ? "rejected" : "approved");
    expect(p!.status).toBe(tak.error ? "rejected" : "approved");
  });

  it("OCR dopisany po zgłoszeniu: tylko własne, tylko raz", async () => {
    await ustawPule("dzialacze", true, MIEJSCA);
    const [a, b] = [osoby[3], osoby[4]];
    await zloz(a);
    const sciezka = `${a.user.id}/dowod.jpg`;
    const ocr = { p_ocr_text: "Przelew JWK26", p_ocr_confidence: 0.9, p_ocr_keywords_hit: 2 };

    // Obcy nie dopisze nic do cudzego zgłoszenia.
    expect((await b.klient.rpc("uzupelnij_ocr", { p_proof_path: sciezka, ...ocr })).error).toBeNull();
    let { data: z } = await admin.from("registrations").select("ocr_text").eq("user_id", a.user.id).single();
    expect(z!.ocr_text).toBeNull();

    expect((await a.klient.rpc("uzupelnij_ocr", { p_proof_path: sciezka, ...ocr })).error).toBeNull();
    expect(
      (await a.klient.rpc("uzupelnij_ocr", { p_proof_path: sciezka, ...ocr, p_ocr_text: "podmiana" })).error,
    ).toBeNull();
    ({ data: z } = await admin
      .from("registrations")
      .select("ocr_text, ocr_confidence, ocr_keywords_hit")
      .eq("user_id", a.user.id)
      .single());
    expect(z).toEqual({ ocr_text: "Przelew JWK26", ocr_confidence: 0.9, ocr_keywords_hit: 2 });
  });
});

// Ten sam kontrakt OCR w zwykłym przebiegu - jedna sesja, bez szturmu.
describe("uzupelnij_ocr", () => {
  it("anonim nie wywoła", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.rpc("uzupelnij_ocr", { p_proof_path: "x/y.jpg" });
    expect(error).not.toBeNull();
  });

  it("bez zgłoszenia nic się nie dzieje i nie ma błędu", async () => {
    const u = await createUser("ocr-bez");
    try {
      const k = await signIn(u);
      const { error } = await k.rpc("uzupelnij_ocr", { p_proof_path: `${u.id}/a.jpg`, p_ocr_text: "x" });
      expect(error).toBeNull();
    } finally {
      await deleteUser(u);
    }
  });
});
