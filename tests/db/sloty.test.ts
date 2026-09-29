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
// spiny. Logowanie raz na plik - projekt testowy dopuszcza 30 na pięć minut.
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
  /** Wycena podanych bębnów - bez losowania i bez grosza obrotu. */
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
    // płacić tyle samo - pomyłka w warunku łapie zwykle tylko dwa z trzech.
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
    // random() - to własność Postgresa. Celuje w dwie awarie mojego kodu:
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

describe("spin", () => {
  /** Wstawia sesje gry kluczem serwisowym, żeby zapełnić okno obrotu. */
  async function zapelnijObrot(userId: string, ileSpinow: number, kiedy?: Date) {
    const wiersze = Array.from({ length: ileSpinow }, () => ({
      user_id: userId,
      game: "sloty",
      stake: 10,
      payout: 0,
      state: { bebny: ["oko", "swieca", "klucz"] },
      ...(kiedy ? { created_at: kiedy.toISOString() } : {}),
    }));
    const { error } = await admin.from("game_sessions").insert(wiersze);
    if (error) throw error;
  }

  it("zaakceptowany gracz kręci: sesja, symbole, netto w księdze", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 200);

    const { data, error } = await graczClient.rpc("zakrec_slotami");
    expect(error).toBeNull();

    const wynik = data as {
      bebny: string[];
      wyplata: number;
      netto: number;
      obrot: number;
      limit: number;
    };
    expect(wynik.bebny).toHaveLength(3);
    expect(wynik.obrot).toBe(10);
    expect(wynik.limit).toBe(300);
    expect(wynik.netto).toBe(wynik.wyplata - 10);

    const { data: sesje } = await admin
      .from("game_sessions")
      .select("user_id, game, stake, payout, status, state");
    expect(sesje).toHaveLength(1);
    expect(sesje![0].user_id).toBe(gracz.id);
    expect(sesje![0].game).toBe("sloty");
    expect(sesje![0].stake).toBe(10);
    expect(sesje![0].status).toBe("settled");
    expect(sesje![0].payout).toBe(wynik.wyplata);
    expect((sesje![0].state as { bebny: string[] }).bebny).toEqual(wynik.bebny);

    // Jeden wpis netto, i tylko gdy różny od zera (D4). Para zwraca stawkę,
    // więc 42% spinów nie zostawia w księdze nic.
    const { data: wpisy } = await admin
      .from("points_ledger")
      .select("delta, user_id, team_id, ref_id")
      .eq("category", "kasyno");
    if (wynik.netto === 0) {
      expect(wpisy ?? []).toEqual([]);
    } else {
      expect(wpisy).toHaveLength(1);
      expect(wpisy![0].delta).toBe(wynik.netto);
      expect(wpisy![0].user_id).toBe(gracz.id);
      expect(wpisy![0].team_id).toBe(druzyna);
    }
  });

  it("niezalogowany nie wywoła funkcji", async () => {
    const { error } = await anonimowy().rpc("zakrec_slotami");
    expect(error).not.toBeNull();
    // Gdyby grant dla anon został, funkcja weszłaby i padła na is_approved() -
    // komunikatem o akceptacji. Cokolwiek innego dowodzi, że revoke zadziałał.
    expect(error!.message).not.toMatch(/zaakceptowan/i);
  });

  it("oczekujący na akceptację nie zakręci", async () => {
    const petent = await createUser("petent-sloty");
    try {
      await admin.from("profiles").update({ team_id: druzyna }).eq("id", petent.id);
      await dosypPunktyOsobie(petent.id, druzyna, 200);
      const client = await signIn(petent);

      const { error } = await client.rpc("zakrec_slotami");
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/zaakceptowan/i);

      const { data } = await admin.from("game_sessions").select("id");
      expect(data ?? []).toEqual([]);
    } finally {
      await deleteUser(petent);
    }
  });

  it("gracz bez drużyny nie zakręci", async () => {
    await admin.from("profiles").update({ team_id: null }).eq("id", gracz.id);
    try {
      const { error } = await graczClient.rpc("zakrec_slotami");
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/druzyny/i);
    } finally {
      await admin.from("profiles").update({ team_id: druzyna }).eq("id", gracz.id);
    }
  });

  it("saldo niższe od stawki odbija spin", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 5);

    const { error } = await graczClient.rpc("zakrec_slotami");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/stawka/i);

    const { data } = await admin.from("game_sessions").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("wyczerpany limit obrotu odbija spin", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 5000);
    // Trzydzieści spinów po dziesięć to dokładnie trzysta punktów obrotu.
    await zapelnijObrot(gracz.id, 30);

    const { error } = await graczClient.rpc("zakrec_slotami");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/limit/i);
  });

  it("obrót starszy niż dobę nie liczy się do limitu", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 5000);
    // Okno jest ruchome i liczy czas absolutny - świadomie, bo czas letni
    // kończy się 25 października 2026, w ostatnią noc wyjazdu (D1).
    const wczoraj = new Date(Date.now() - 25 * 3_600_000);
    await zapelnijObrot(gracz.id, 30, wczoraj);

    const { error } = await graczClient.rpc("zakrec_slotami");
    expect(error).toBeNull();
  });

  it("księga dostaje wpis na każdy spin niezerowy i żadnego na zerowy", async () => {
    await dosypPunktyOsobie(gracz.id, druzyna, 5000);

    // Dwanaście spinów to 120 punktów obrotu, dobrze poniżej limitu 300.
    //
    // Test **nie zakłada, co wypadnie** - porównuje księgę z sesjami, więc jest
    // rozstrzygający niezależnie od losu. Wcześniejsza wersja sprawdzałaby zwrot
    // stawki tylko wtedy, gdy para akurat padła, czyli w 42% przebiegów udawała,
    // że coś weryfikuje.
    for (let i = 0; i < 12; i++) {
      const { error } = await graczClient.rpc("zakrec_slotami");
      expect(error).toBeNull();
    }

    const { data: sesje } = await admin
      .from("game_sessions")
      .select("id, stake, payout");
    expect(sesje).toHaveLength(12);

    const { data: wpisy } = await admin
      .from("points_ledger")
      .select("delta, ref_id")
      .eq("category", "kasyno");

    const niezerowe = sesje!.filter((x) => x.payout !== x.stake);
    expect(wpisy ?? []).toHaveLength(niezerowe.length);

    // Każdy wpis wskazuje swoją sesję i niesie dokładnie jej netto.
    const netto = new Map(
      niezerowe.map((x) => [
        x.id as string,
        (x.payout as number) - (x.stake as number),
      ]),
    );
    for (const w of wpisy ?? []) {
      expect(netto.get(w.ref_id as string)).toBe(w.delta);
    }
  });

  it("dwa równoległe spiny przy saldzie na jeden: jeden przechodzi", async () => {
    // Stawka to 10, saldo dokładnie 10. Bez blokady wiersza profiles oba
    // wywołania przeczytają to samo saldo i oba przejdą, a gracz zjedzie pod
    // zero - księga jest tylko do dopisywania, więc nie ma jak tego cofnąć.
    //
    // Wypłaty zerujemy na czas testu. Bez tego wynik zależał od losu: para
    // (42% spinów) zwraca stawkę, saldo zostaje 10 i drugi spin słusznie
    // przechodzi - test padał wtedy mimo działającej blokady.
    const { data: ustawienie } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "slots_wyplaty")
      .single();
    await admin
      .from("app_settings")
      .update({ value: { trojka_oko: 0, trojka: 0, para: 0 } })
      .eq("key", "slots_wyplaty");

    try {
      await dosypPunktyOsobie(gracz.id, druzyna, 10);

      const [a, b] = await Promise.all([
        graczClient.rpc("zakrec_slotami"),
        graczClient.rpc("zakrec_slotami"),
      ]);

      const udane = [a, b].filter((r) => r.error === null);
      expect(udane).toHaveLength(1);

      const { data: sesje } = await admin.from("game_sessions").select("id");
      expect(sesje).toHaveLength(1);

      // Saldo gracza nie może być ujemne.
      const { data: wynik } = await admin
        .from("user_scores")
        .select("score")
        .eq("user_id", gracz.id)
        .single();
      expect(wynik!.score).toBeGreaterThanOrEqual(0);
    } finally {
      await admin
        .from("app_settings")
        .update({ value: ustawienie!.value })
        .eq("key", "slots_wyplaty");
    }
  });
});
