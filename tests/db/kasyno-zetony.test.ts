import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  idDruzyn,
  ustawJakoZaakceptowany,
  saldoDruzyny,
  type TestUser,
} from "../helpers/supabase";

// Kasyno po gali: żetony zamiast punktów drużyny. Dwóch graczy - drugi do wyzwań.
let gracz: TestUser;
let rywal: TestUser;
let graczClient: SupabaseClient;
let rywalClient: SupabaseClient;
let druzyna: string;

async function ustaw(key: string, value: unknown) {
  const { error } = await admin.from("app_settings").upsert({ key, value });
  if (error) throw error;
}

async function zetony(id: string): Promise<{ saldo: number; dokladki: number } | null> {
  const { data } = await admin.from("kasyno_zetony").select("saldo, dokladki").eq("user_id", id).maybeSingle();
  return data as { saldo: number; dokladki: number } | null;
}

async function ustawSaldo(id: string, saldo: number) {
  await admin.from("kasyno_zetony").upsert({ user_id: id, saldo, dokladki: 0 });
}

beforeAll(async () => {
  druzyna = (await idDruzyn())[0];
  [gracz, rywal] = await Promise.all([createUser("gracz-zetony"), createUser("rywal-zetony")]);
  await ustawJakoZaakceptowany(gracz, druzyna);
  await ustawJakoZaakceptowany(rywal, druzyna);
  await admin.from("profiles").update({ display_name: "Gracz" }).eq("id", gracz.id);
  await admin.from("profiles").update({ display_name: "Rywal" }).eq("id", rywal.id);
  graczClient = await signIn(gracz);
  rywalClient = await signIn(rywal);
  await ustaw("kasyno_zetony", true);
});

afterEach(async () => {
  await admin.from("kasyno_wyzwania").delete().not("id", "is", null);
  await admin.from("game_sessions").delete().in("user_id", [gracz.id, rywal.id]);
  await admin.from("kasyno_zetony").delete().in("user_id", [gracz.id, rywal.id]);
  await admin.from("powiadomienia").delete().in("ref_type", ["wyzwanie", "jackpot"]);
  await admin.from("kasyno_jackpot").update({ kwota: 500 }).eq("id", true);
});

afterAll(async () => {
  await ustaw("kasyno_zetony", false);
  await Promise.all([gracz, rywal].map(deleteUser));
});

describe("żetony zamiast punktów", () => {
  it("spin zmienia żetony, a punkty drużyny stoją", async () => {
    const przed = await saldoDruzyny(druzyna);
    const { data, error } = await graczClient.rpc("zakrec_slotami");
    expect(error).toBeNull();
    const netto = (data as { netto: number }).netto;
    expect(await saldoDruzyny(druzyna)).toBe(przed);
    expect((await zetony(gracz.id))?.saldo ?? 1000).toBe(1000 + netto);
    const { data: wpisy } = await admin.from("points_ledger").select("id").eq("user_id", gracz.id).eq("category", "kasyno");
    expect(wpisy ?? []).toEqual([]);
  });

  it("blackjack bierze stawkę z żetonów i oddaje wygraną w żetonach", async () => {
    // Gracz 10+9 = 19, krupier 10+7 = 17 - wygrana na staniu.
    const reszta = ["2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s", "2h", "3h"];
    const { error } = await admin.rpc("bj_start", { p_user: gracz.id, p_stawka: 50, p_talia: ["10s", "10h", "9s", "7h", ...reszta] });
    expect(error).toBeNull();
    expect((await zetony(gracz.id))!.saldo).toBe(950);
    await admin.rpc("bj_ruch", { p_user: gracz.id, p_ruch: "stan" });
    expect((await zetony(gracz.id))!.saldo).toBe(1050);
  });

  it("brak limitu czasowego: gra, dopóki starcza żetonów, potem dokładka", async () => {
    await ustawSaldo(gracz.id, 15);
    const { error: e1 } = await graczClient.rpc("zakrec_slotami");
    expect(e1).toBeNull();
    await ustawSaldo(gracz.id, 5);
    const { error: e2 } = await graczClient.rpc("zakrec_slotami");
    expect(e2!.message).toMatch(/limit/i);

    const { data: nowe, error: e3 } = await graczClient.rpc("dokladka_zetonow");
    expect(e3).toBeNull();
    expect(nowe).toBe(1000);
    expect(await zetony(gracz.id)).toMatchObject({ saldo: 1000, dokladki: 1 });

    // Z żetonami w kieszeni dokładki nie ma.
    const { error: e4 } = await graczClient.rpc("dokladka_zetonow");
    expect(e4!.message).toMatch(/zetony/i);
  });

  it("Król Kasyna liczy bilans: dokładka to pożyczka", async () => {
    await admin.from("kasyno_zetony").upsert([
      { user_id: gracz.id, saldo: 1500, dokladki: 1 },
      { user_id: rywal.id, saldo: 900, dokladki: 0 },
    ]);
    const { data } = await graczClient.rpc("krol_kasyna");
    const moje = (data as { user_id: string; bilans: number }[]).filter((r) => [gracz.id, rywal.id].includes(r.user_id));
    expect(moje).toEqual([
      expect.objectContaining({ user_id: rywal.id, bilans: 900 }),
      expect.objectContaining({ user_id: gracz.id, bilans: 500 }),
    ]);
  });
});

describe("jackpot", () => {
  it("każdy spin dosypuje, trójka Oka zgarnia całość i woła wszystkich", async () => {
    await graczClient.rpc("zakrec_slotami");
    const { data: po } = await admin.from("kasyno_jackpot").select("kwota").single();
    expect(po!.kwota).toBe(502);

    await ustawSaldo(gracz.id, 1000);
    await admin.from("game_sessions").insert({
      user_id: gracz.id, game: "sloty", stake: 10, payout: 400, status: "settled", state: { bebny: ["oko", "oko", "oko"] },
    });
    expect((await zetony(gracz.id))!.saldo).toBe(1000 + 504);
    const { data: reset } = await admin.from("kasyno_jackpot").select("kwota, ostatni_zwyciezca").single();
    expect(reset).toMatchObject({ kwota: 500, ostatni_zwyciezca: gracz.id });
    const { data: push } = await admin.from("powiadomienia").select("adresat, tytul").eq("ref_type", "jackpot");
    expect(push).toEqual([{ adresat: "all", tytul: "JACKPOT!" }]);
  });
});

describe("wyzwania 1 na 1", () => {
  it("stawka schodzi przy wyzwaniu, wygrany bierze pulę, przegrany dostaje push", async () => {
    await ustawSaldo(gracz.id, 1000);
    await ustawSaldo(rywal.id, 1000);
    const { data: id, error } = await graczClient.rpc("wyzwij", { p_do: rywal.id, p_stawka: 100 });
    expect(error).toBeNull();
    expect((await zetony(gracz.id))!.saldo).toBe(900);
    const { data: zapro } = await admin.from("powiadomienia").select("adresat_id").eq("ref_type", "wyzwanie");
    expect(zapro).toEqual([{ adresat_id: rywal.id }]);

    // Wyzywający 10+9 = 19, wyzwany 10+7 = 17.
    const { data: wynik, error: e2 } = await admin.rpc("wyzwanie_rozegraj", { p_id: id, p_talia: ["10s", "10h", "9s", "7h"] });
    expect(e2).toBeNull();
    expect(wynik).toMatchObject({ punkty_od: 19, punkty_do: 17, zwyciezca: gracz.id });
    expect((await zetony(gracz.id))!.saldo).toBe(1100);
    expect((await zetony(rywal.id))!.saldo).toBe(900);
  });

  it("remis zwraca obie stawki", async () => {
    await ustawSaldo(gracz.id, 1000);
    await ustawSaldo(rywal.id, 1000);
    const { data: id } = await graczClient.rpc("wyzwij", { p_do: rywal.id, p_stawka: 50 });
    await admin.rpc("wyzwanie_rozegraj", { p_id: id, p_talia: ["10s", "10h", "8s", "8h"] });
    expect((await zetony(gracz.id))!.saldo).toBe(1000);
    expect((await zetony(rywal.id))!.saldo).toBe(1000);
  });

  it("odrzucenie oddaje stawkę, a cudzego wyzwania nie przyjmiesz", async () => {
    await ustawSaldo(gracz.id, 1000);
    const { data: id } = await graczClient.rpc("wyzwij", { p_do: rywal.id, p_stawka: 30 });
    const { error: obce } = await graczClient.rpc("przyjmij_wyzwanie", { p_id: id });
    expect(obce!.message).toMatch(/nie czeka na Ciebie/);
    const { error } = await rywalClient.rpc("zamknij_wyzwanie", { p_id: id });
    expect(error).toBeNull();
    expect((await zetony(gracz.id))!.saldo).toBe(1000);
    const { data: w } = await admin.from("kasyno_wyzwania").select("status").eq("id", id).single();
    expect(w!.status).toBe("odrzucone");
  });

  it("przyjęcie przez wyzwanego rozgrywa pojedynek losową talią", async () => {
    await ustawSaldo(gracz.id, 1000);
    await ustawSaldo(rywal.id, 1000);
    const { data: id } = await graczClient.rpc("wyzwij", { p_do: rywal.id, p_stawka: 20 });
    const { data, error } = await rywalClient.rpc("przyjmij_wyzwanie", { p_id: id });
    expect(error).toBeNull();
    const suma = (await zetony(gracz.id))!.saldo + (await zetony(rywal.id))!.saldo;
    expect(suma).toBe(2000);
    expect(data).toHaveProperty("punkty_od");
  });
});

describe("tryb punktów (przełącznik wyłączony)", () => {
  it("bez przełącznika kasyno dalej pisze do księgi punktów", async () => {
    await ustaw("kasyno_zetony", false);
    try {
      const { data: tr } = await graczClient.rpc("moje_zetony");
      expect((tr as { tryb: boolean }).tryb).toBe(false);
      const { error } = await graczClient.rpc("wyzwij", { p_do: rywal.id, p_stawka: 10 });
      expect(error!.message).toMatch(/niedostepne/);
    } finally {
      await ustaw("kasyno_zetony", true);
    }
  });
});
