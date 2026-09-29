import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  anonimowy,
  signIn,
  createUser,
  deleteUser,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

let gracz: TestUser;
let czekajacy: TestUser;
let graczClient: SupabaseClient;
let czekajacyClient: SupabaseClient;

beforeAll(async () => {
  [gracz, czekajacy] = await Promise.all([createUser("gracz-kruk"), createUser("czekajacy-kruk")]);
  await ustawJakoZaakceptowany(gracz);
  graczClient = await signIn(gracz);
  czekajacyClient = await signIn(czekajacy);
});

afterEach(async () => {
  await admin.from("kruk_gry").delete().in("user_id", [gracz.id, czekajacy.id]);
});

afterAll(async () => {
  await Promise.all([gracz, czekajacy].map(deleteUser));
});

async function start(): Promise<string> {
  const { data, error } = await graczClient.rpc("kruk_start");
  if (error) throw error;
  return data as string;
}

/**
 * Cofa start gry o minutę - test nie czeka, aż kruk naprawdę przeleci.
 * Minuta, nie mniej: zegar maszyny testowej i bazy mogą się rozjeżdżać
 * o sekundy, a limit po minucie (41) zostawia na to dużo miejsca.
 */
async function cofnijOMinute(gra: string): Promise<void> {
  const { error } = await admin
    .from("kruk_gry")
    .update({ started_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", gra);
  if (error) throw error;
}

function wynik(client: SupabaseClient, gra: string, w: number) {
  return client.rpc("kruk_wynik", { p_gra: gra, p_wynik: w });
}

describe("kruk_start i kruk_wynik", () => {
  it("wynik mieszczący się w czasie trafia do rankingu", async () => {
    const gra = await start();
    await cofnijOMinute(gra);
    const { data, error } = await wynik(graczClient, gra, 20);
    expect(error).toBeNull();
    expect(data).toBe(20);

    const { data: r } = await graczClient
      .from("kruk_ranking")
      .select("rekord")
      .eq("user_id", gracz.id)
      .single();
    expect(r).toEqual({ rekord: 20 });
  });

  it("wynik niemożliwy w czasie od startu jest odrzucany", async () => {
    const gra = await start();
    const { error } = await wynik(graczClient, gra, 50);
    expect(error!.message).toMatch(/niemozliwy/);
  });

  it("drugie zgłoszenie tej samej gry odpada", async () => {
    const gra = await start();
    expect((await wynik(graczClient, gra, 1)).error).toBeNull();
    const { error } = await wynik(graczClient, gra, 1);
    expect(error!.message).toMatch(/juz zapisany/);
  });

  it("wynik ujemny odpada", async () => {
    const gra = await start();
    const { error } = await wynik(graczClient, gra, -1);
    expect(error!.message).toMatch(/ujemny/);
  });

  it("do cudzej gry nie da się zgłosić wyniku", async () => {
    const gra = await start();
    const { error } = await wynik(czekajacyClient, gra, 1);
    expect(error!.message).toMatch(/Nie ma takiej gry/);
  });

  it("nieprzyjęty uczestnik nie wystartuje", async () => {
    const { error } = await czekajacyClient.rpc("kruk_start");
    expect(error!.message).toMatch(/zaakceptowani/);
  });

  it("nowy start usuwa niedokończoną grę", async () => {
    const pierwsza = await start();
    const druga = await start();
    const { data } = await admin.from("kruk_gry").select("id").eq("user_id", gracz.id);
    expect(data).toEqual([{ id: druga }]);
    const { error } = await wynik(graczClient, pierwsza, 1);
    expect(error!.message).toMatch(/Nie ma takiej gry/);
  });

  it("ranking pokazuje najlepszy wynik, nie ostatni", async () => {
    const lepsza = await start();
    await cofnijOMinute(lepsza);
    await wynik(graczClient, lepsza, 7);
    const gorsza = await start();
    await cofnijOMinute(gorsza);
    const { data } = await wynik(graczClient, gorsza, 3);
    // Funkcja zwraca rekord po tej grze, nie jej wynik.
    expect(data).toBe(7);

    const { data: r } = await graczClient
      .from("kruk_ranking")
      .select("rekord")
      .eq("user_id", gracz.id)
      .single();
    expect(r).toEqual({ rekord: 7 });
  });
});

describe("dostęp", () => {
  it("gracz nie czyta ani nie pisze do kruk_gry bezpośrednio", async () => {
    // Brak grantu: błąd uprawnień, nie pusta lista - pusta lista niczego by nie dowodziła.
    const odczyt = await graczClient.from("kruk_gry").select("id");
    expect(odczyt.error?.code).toBe("42501");
    const zapis = await graczClient.from("kruk_gry").insert({ user_id: gracz.id, wynik: 999 });
    expect(zapis.error?.code).toBe("42501");
  });

  it("ranking jest tylko dla zalogowanych", async () => {
    const { error } = await anonimowy().from("kruk_ranking").select("rekord");
    expect(error?.code).toBe("42501");
  });
});
