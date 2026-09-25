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
