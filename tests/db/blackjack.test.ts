import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  idDruzyn,
  ustawJakoZaakceptowany,
  dosypPunktyOsobie,
  type TestUser,
} from "../helpers/supabase";

type Widok = {
  id: string;
  stawka: number;
  status: "open" | "settled";
  gracz: string[];
  krupier: string[];
  punkty_gracza: number;
  punkty_krupiera: number | null;
  wynik: "wygrana" | "przegrana" | "remis" | "blackjack" | "fura" | null;
  wyplata: number | null;
  mozna_podwoic: boolean;
};

// Talia w kolejności rozdawania: gracz, krupier, gracz, krupier, potem dobierane.
// Funkcja rdzeniowa z ustaloną talią jest wyłącznie dla klucza serwisowego —
// gracz nigdy nie wybiera kart.
const reszta = ["2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s", "2h", "3h"];

let gracz: TestUser;
let czekajacy: TestUser;
let graczClient: SupabaseClient;
let czekajacyClient: SupabaseClient;
let druzyna: string;

beforeAll(async () => {
  [druzyna] = await idDruzyn();
  [gracz, czekajacy] = await Promise.all([createUser("gracz-bj"), createUser("czekajacy-bj")]);
  await ustawJakoZaakceptowany(gracz, druzyna);
  graczClient = await signIn(gracz);
  czekajacyClient = await signIn(czekajacy);
});

afterEach(async () => {
  await admin.from("game_sessions").delete().in("user_id", [gracz.id, czekajacy.id]);
  await admin.from("points_ledger").delete().eq("user_id", gracz.id);
});

afterAll(async () => {
  await Promise.all([gracz, czekajacy].map(deleteUser));
});

async function saldo(): Promise<number> {
  const { data } = await admin.from("points_ledger").select("delta").eq("user_id", gracz.id);
  return (data ?? []).reduce((s, r) => s + (r.delta as number), 0);
}

async function start(talia: string[], stawka = 10): Promise<Widok> {
  const { data, error } = await admin.rpc("bj_start", {
    p_user: gracz.id,
    p_stawka: stawka,
    p_talia: [...talia, ...reszta],
  });
  if (error) throw error;
  return data as Widok;
}

async function ruch(r: string): Promise<Widok> {
  const { data, error } = await admin.rpc("bj_ruch", { p_user: gracz.id, p_ruch: r });
  if (error) throw error;
  return data as Widok;
}

describe("wartość ręki", () => {
  it("liczy asy jako 11 albo 1", async () => {
    const w = async (k: string[]) => (await graczClient.rpc("bj_wartosc", { p_karty: k })).data;
    expect(await w(["As", "Kh"])).toBe(21);
    expect(await w(["As", "As", "9d"])).toBe(21);
    expect(await w(["10s", "9h", "5d"])).toBe(24);
    expect(await w(["As", "6h"])).toBe(17);
  });
});

describe("rozgrywka", () => {
  it("wygrana na staniu płaci podwójnie, stawka schodzi od razu przy rozdaniu", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    // Gracz 10+9 = 19, krupier 10+7 = 17.
    const w = await start(["10s", "10h", "9s", "7h"]);
    expect(w.status).toBe("open");
    // Druga karta krupiera zakryta, dopóki ręka trwa.
    expect(w.krupier).toEqual(["10h"]);
    expect(await saldo()).toBe(90);

    const koniec = await ruch("stan");
    expect(koniec).toMatchObject({ status: "settled", wynik: "wygrana", wyplata: 20, punkty_krupiera: 17 });
    expect(koniec.krupier).toEqual(["10h", "7h"]);
    expect(await saldo()).toBe(110);
  });

  it("fura kończy rękę bez wypłaty", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    // Gracz 10+6 = 16, dobiera 10 → 26.
    await start(["10s", "10h", "6s", "7h", "10d"]);
    const w = await ruch("dobierz");
    expect(w).toMatchObject({ status: "settled", wynik: "fura", wyplata: 0, punkty_gracza: 26 });
    expect(await saldo()).toBe(90);
  });

  it("blackjack z rozdania płaci 6:5 i rozstrzyga się od razu", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    const w = await start(["As", "9h", "Ks", "7h"]);
    // 6:5 zamiast 3:2 — przewaga kasyna (2026-09-28): stawka 10 wraca jako 22.
    expect(w).toMatchObject({ status: "settled", wynik: "blackjack", wyplata: 22 });
    expect(await saldo()).toBe(112);
  });

  it("krupier dobiera na miękkie 17", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    // Gracz 10+8 = 18, krupier A+6 = miękkie 17 → dobiera 2 → 19.
    await start(["10s", "As", "8s", "6h", "2d"]);
    const w = await ruch("stan");
    expect(w).toMatchObject({ wynik: "przegrana", punkty_krupiera: 19 });
  });

  it("podwojenie tylko przy 9, 10 albo 11", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    // 10+2 = 12: podwojenie niedostępne.
    const w = await start(["10s", "10h", "2s", "7h"]);
    expect(w.mozna_podwoic).toBe(false);
    const { error } = await admin.rpc("bj_ruch", { p_user: gracz.id, p_ruch: "podwoj" });
    expect(error!.message).toMatch(/9, 10 albo 11/);
  });

  it("krupier dobiera do 17 i może wygrać", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    // Gracz 10+8 = 18, krupier 10+6 = 16 → dobiera 5 → 21.
    await start(["10s", "10h", "8s", "6h", "5d"]);
    const w = await ruch("stan");
    expect(w).toMatchObject({ wynik: "przegrana", wyplata: 0, punkty_krupiera: 21 });
  });

  it("podwojenie dobiera jedną kartę, podwaja stawkę i kończy rękę", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    // Gracz 5+6 = 11 → podwaja, dostaje 10 → 21; krupier 10+6 = 16 → 9 → 25.
    const w0 = await start(["5s", "10h", "6s", "6h", "10d", "9d"]);
    expect(w0.mozna_podwoic).toBe(true);
    const w = await ruch("podwoj");
    expect(w).toMatchObject({ status: "settled", wynik: "wygrana", stawka: 20, wyplata: 40 });
    expect(w.gracz).toHaveLength(3);
    expect(await saldo()).toBe(120);
  });

  it("remis zwraca stawkę", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    await start(["10s", "10h", "8s", "8h"]);
    const w = await ruch("stan");
    expect(w).toMatchObject({ wynik: "remis", wyplata: 10 });
    expect(await saldo()).toBe(100);
  });
});

describe("zasady i uprawnienia", () => {
  it("gracz widzi otwartą rękę bez zakrytej karty krupiera", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    await start(["10s", "10h", "9s", "7h"]);
    const { data, error } = await graczClient.rpc("blackjack_stan");
    expect(error).toBeNull();
    const w = data as Widok;
    expect(w.gracz).toEqual(["10s", "9s"]);
    expect(w.krupier).toEqual(["10h"]);
    // Talia nie wychodzi w żadnej postaci.
    expect(JSON.stringify(w)).not.toContain("7h");
    expect(JSON.stringify(w)).not.toContain("talia");
  });

  it("gracz porusza się wyłącznie własną ręką, przez funkcję dla siebie", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    await start(["10s", "10h", "9s", "7h"]);
    const { data, error } = await graczClient.rpc("blackjack_ruch", { p_ruch: "stan" });
    expect(error).toBeNull();
    expect((data as Widok).status).toBe("settled");
  });

  it("gracz nie wywoła funkcji z ustaloną talią", async () => {
    const { error } = await graczClient.rpc("bj_start", {
      p_user: gracz.id,
      p_stawka: 10,
      p_talia: ["As", "2h", "Ks", "3h", ...reszta],
    });
    expect(error).not.toBeNull();
  });

  it("stawka tylko 10, 20 albo 50", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    const { error } = await graczClient.rpc("blackjack_rozdaj", { p_stawka: 15 });
    expect(error!.message).toMatch(/stawk/i);
  });

  it("za małe saldo, druga ręka w toku i nieprzyjęty gracz są odbijani", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 5);
    const bezSalda = await graczClient.rpc("blackjack_rozdaj", { p_stawka: 10 });
    expect(bezSalda.error!.message).toMatch(/pkt/);

    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    await start(["10s", "10h", "9s", "7h"]);
    const druga = await graczClient.rpc("blackjack_rozdaj", { p_stawka: 10 });
    expect(druga.error!.message).toMatch(/w toku/);

    const czekajacyRozdaje = await czekajacyClient.rpc("blackjack_rozdaj", { p_stawka: 10 });
    expect(czekajacyRozdaje.error).not.toBeNull();
  });

  it("wspólny limit obrotu ze slotami zatrzymuje rozdanie", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 5000);
    // 29 spinów po 10 = 290; limit 300, więc stawka 20 już się nie mieści.
    const spiny = Array.from({ length: 29 }, () => ({
      user_id: gracz.id,
      game: "sloty",
      stake: 10,
      payout: 0,
      state: { bebny: ["oko", "swieca", "klucz"] },
    }));
    await admin.from("game_sessions").insert(spiny);
    const { error } = await graczClient.rpc("blackjack_rozdaj", { p_stawka: 20 });
    expect(error!.message).toMatch(/limit/i);
  });

  it("ręka porzucona na 10 minut rozstrzyga się jak stanie", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 100);
    const w = await start(["10s", "10h", "9s", "7h"]);
    await admin
      .from("game_sessions")
      .update({ created_at: new Date(Date.now() - 11 * 60_000).toISOString() })
      .eq("id", w.id);

    expect((await admin.rpc("bj_porzucone")).error).toBeNull();

    const { data } = await admin.from("game_sessions").select("status, payout").eq("id", w.id).single();
    expect(data).toEqual({ status: "settled", payout: 20 });
  });
});
