import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  createUser,
  deleteUser,
  idDruzyn,
  ustawJakoZaakceptowany,
  dosypPunktyOsobie,
  type TestUser,
} from "../helpers/supabase";

// Dwóch graczy z tej samej drużyny: jeden gra, drugi sprawdza, czy widzi cudze
// spiny. Logowanie raz na plik — projekt testowy dopuszcza 30 na pięć minut.
let gracz: TestUser;
let obcy: TestUser;
let graczClient: SupabaseClient;
let obcyClient: SupabaseClient;
let druzyna: string;

beforeAll(async () => {
  druzyna = (await idDruzyn())[0];
  gracz = await createUser("gracz-sloty");
  obcy = await createUser("obcy-sloty");
  await ustawJakoZaakceptowany(gracz, druzyna);
  await ustawJakoZaakceptowany(obcy, druzyna);
  graczClient = await signIn(gracz);
  obcyClient = await signIn(obcy);
});

afterAll(async () => {
  await deleteUser(gracz);
  await deleteUser(obcy);
});

afterEach(async () => {
  await admin.from("game_sessions").delete().not("id", "is", null);
  await admin
    .from("points_ledger")
    .delete()
    .in("category", ["zasiew_testowy", "kasyno"]);
});

describe("fundament kasyna", () => {
  it("ustawienia slotów są zasiane, slots_rtp usunięte", async () => {
    const { data } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["slots_stawka", "slots_wyplaty", "casino_daily_stake_cap", "slots_rtp"]);

    const wg = new Map((data ?? []).map((r) => [r.key, r.value]));

    expect(Number(wg.get("slots_stawka"))).toBe(10);
    expect(Number(wg.get("casino_daily_stake_cap"))).toBe(300);
    expect(wg.get("slots_wyplaty")).toEqual({
      trojka_oko: 400,
      trojka: 120,
      para: 10,
    });

    // RTP nie jest pokrętłem, jest konsekwencją tabeli wypłat. Wiersz, który
    // wygląda na nastawę, a którego zmiana nic nie robi, to pułapka (D8).
    expect(wg.has("slots_rtp")).toBe(false);
  });

  it("gracz nie przeczyta kolumny state", async () => {
    await admin.from("game_sessions").insert({
      user_id: gracz.id,
      game: "sloty",
      stake: 10,
      payout: 0,
      state: { bebny: ["oko", "swieca", "klucz"] },
    });

    // Grant kolumnowy zabiera `state`. Przy blackjacku ta kolumna będzie trzymać
    // nierozdane karty, więc jej odczyt byłby podglądaniem następnej karty.
    const { error } = await graczClient.from("game_sessions").select("state");
    expect(error).not.toBeNull();

    // Kolumny dozwolone czyta bez przeszkód.
    const { data, error: bladDozwolonych } = await graczClient
      .from("game_sessions")
      .select("id, game, stake, payout, status, created_at");
    expect(bladDozwolonych).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("gracz nie widzi cudzych spinów ani w tabeli, ani w widoku", async () => {
    await admin.from("game_sessions").insert({
      user_id: gracz.id,
      game: "sloty",
      stake: 10,
      payout: 400,
      state: { bebny: ["oko", "oko", "oko"] },
    });

    // Dwie drogi odczytu, dwa różne zabezpieczenia: polityka RLS na tabeli
    // i warunek w ciele widoku (który idzie prawami właściciela, więc RLS go
    // nie dotyczy). Pominięcie jednego wygląda na zabezpieczone.
    const { data: zTabeli } = await obcyClient.from("game_sessions").select("id");
    expect(zTabeli ?? []).toEqual([]);

    const { data: zWidoku } = await obcyClient.from("moje_spiny").select("id");
    expect(zWidoku ?? []).toEqual([]);

    const { data: swoje } = await graczClient.from("moje_spiny").select("id, bebny");
    expect(swoje).toHaveLength(1);
    expect(swoje![0].bebny).toEqual(["oko", "oko", "oko"]);
  });

  it("niezalogowany nie widzi nic", async () => {
    await admin.from("game_sessions").insert({
      user_id: gracz.id,
      game: "sloty",
      stake: 10,
      payout: 0,
      state: { bebny: ["klucz", "klucz", "oko"] },
    });

    const anon = anonimowy();
    const { data: t } = await anon.from("game_sessions").select("id");
    expect(t ?? []).toEqual([]);
    const { data: w } = await anon.from("moje_spiny").select("id");
    expect(w ?? []).toEqual([]);
  });

  it("gracz nie dopisze sobie sesji gry", async () => {
    const { error } = await graczClient.from("game_sessions").insert({
      user_id: gracz.id,
      game: "sloty",
      stake: 10,
      payout: 400,
    });
    expect(error).not.toBeNull();

    const { data } = await admin.from("game_sessions").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("bębny", () => {
  /** Wycena podanych bębnów — bez losowania i bez grosza obrotu. */
  async function wycen(bebny: string[]): Promise<number> {
    const { data, error } = await graczClient.rpc("rozstrzygnij_bebny", {
      p_bebny: bebny,
    });
    if (error) throw error;
    return data as number;
  }

  it("trójka Oka płaci czterysta", async () => {
    expect(await wycen(["oko", "oko", "oko"])).toBe(400);
  });

  it("inna trójka płaci sto dwadzieścia", async () => {
    expect(await wycen(["swieca", "swieca", "swieca"])).toBe(120);
    expect(await wycen(["klucz", "klucz", "klucz"])).toBe(120);
  });

  it("para zwraca stawkę, niezależnie od pozycji", async () => {
    // Trzy układy pary: pierwsze dwa, ostatnie dwa, skrajne. Wszystkie muszą
    // płacić tyle samo — pomyłka w warunku łapie zwykle tylko dwa z trzech.
    expect(await wycen(["oko", "oko", "klucz"])).toBe(10);
    expect(await wycen(["klucz", "oko", "oko"])).toBe(10);
    expect(await wycen(["oko", "klucz", "oko"])).toBe(10);
  });

  it("trzy różne nie płacą nic", async () => {
    expect(await wycen(["oko", "swieca", "klucz"])).toBe(0);
  });

  it("zła liczba bębnów odbija się", async () => {
    await expect(wycen(["oko", "oko"])).rejects.toThrow();
  });

  it("losuje trzy razy niezależnie i nie wychodzi z zakresu", async () => {
    const SYMBOLE = ["oko", "swieca", "kielich", "sztylet", "pieczec", "klucz"];

    // Sześćdziesiąt losowań równolegle. Kryterium nie sprawdza jednostajności
    // random() — to własność Postgresa. Celuje w dwie awarie mojego kodu:
    // indeksowanie od zera (tablice w Postgresie liczą od jedynki, więc bez `+1`
    // wychodzi NULL) i użycie jednego losowania do trzech bębnów.
    const losowania = await Promise.all(
      Array.from({ length: 60 }, () => graczClient.rpc("losuj_bebny")),
    );

    const bebny = losowania.map((r) => {
      expect(r.error).toBeNull();
      return r.data as string[];
    });

    for (const b of bebny) {
      expect(b).toHaveLength(3);
      for (const s of b) expect(SYMBOLE).toContain(s);
    }

    // W 180 pozycjach każdy z sześciu symboli powinien wypaść choć raz:
    // szansa pominięcia to (5/6)^180, czyli rząd 1e-14.
    const widziane = new Set(bebny.flat());
    expect([...widziane].sort()).toEqual([...SYMBOLE].sort());

    // Całe rozróżnienie między poprawnym kodem i jednym losowaniem użytym
    // trzykrotnie: przy tej pomyłce trójek byłoby 60 z 60.
    const nieTrojki = bebny.filter((b) => !(b[0] === b[1] && b[1] === b[2]));
    expect(nieTrojki.length).toBeGreaterThan(0);
  });
});
