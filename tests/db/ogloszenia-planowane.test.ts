import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, signIn, createUser, deleteUser, makeAdmin, ustawJakoZaakceptowany, type TestUser } from "../helpers/supabase";

// Ogłoszenia planowane (2026-10-15): admin ustawia godzinę, cron co minutę
// wkłada dojrzałe do skrzynki powiadomień. W teście cron zastępuje wywołanie
// wyslij_zaplanowane() kluczem serwisowym.
const TAG = `plan-${Date.now()}`;
let szef: TestUser;
let ala: TestUser;
let szefClient: SupabaseClient;
let alaClient: SupabaseClient;

beforeAll(async () => {
  [szef, ala] = await Promise.all([createUser("szef-plan"), createUser("ala-plan")]);
  await makeAdmin(szef);
  await ustawJakoZaakceptowany(szef);
  await ustawJakoZaakceptowany(ala);
  [szefClient, alaClient] = await Promise.all([signIn(szef), signIn(ala)]);
});

afterEach(async () => {
  await admin.from("ogloszenia_planowane").delete().like("tytul", `${TAG}%`);
  await admin.from("powiadomienia").delete().like("tytul", `${TAG}%`);
});

afterAll(async () => {
  await Promise.all([szef, ala].map(deleteUser));
});

const zaGodzine = () => new Date(new Date().getTime() + 3_600_000).toISOString();

async function zaplanuj(client: SupabaseClient, opcje: Record<string, unknown> = {}) {
  return client.rpc("zaplanuj_ogloszenie", {
    p_tytul: `${TAG} Zbiórka`,
    p_tresc: "O 10:00 przy autokarze",
    p_adresat: "all",
    p_kiedy: zaGodzine(),
    ...opcje,
  });
}

async function wyslaneTeraz(id: number) {
  await admin.from("ogloszenia_planowane").update({ kiedy: new Date(new Date().getTime() - 60_000).toISOString() }).eq("id", id);
  const { error } = await admin.rpc("wyslij_zaplanowane");
  if (error) throw error;
}

async function wSkrzynce() {
  const { data } = await admin.from("powiadomienia").select("kanal, tytul, ref_type").like("tytul", `${TAG}%`);
  return data ?? [];
}

describe("ogłoszenia planowane", () => {
  it("uczestnik nie zaplanuje", async () => {
    const { error } = await zaplanuj(alaClient);
    expect(error!.message).toMatch(/admin/i);
  });

  it("godzina z przeszłości i pusta treść są odbijane od razu", async () => {
    const wczoraj = await zaplanuj(szefClient, { p_kiedy: new Date(new Date().getTime() - 86_400_000).toISOString() });
    expect(wczoraj.error!.message).toMatch(/minela/);
    const pusta = await zaplanuj(szefClient, { p_tresc: "  " });
    expect(pusta.error!.message).toMatch(/Tresc/);
  });

  it("czeka do swojej godziny, potem wychodzi raz - push i SMS", async () => {
    const { data: id, error } = await zaplanuj(szefClient, { p_sms: true });
    expect(error).toBeNull();

    // Przed czasem nic nie wychodzi.
    await admin.rpc("wyslij_zaplanowane");
    expect(await wSkrzynce()).toEqual([]);

    await wyslaneTeraz(id as number);
    const skrzynka = await wSkrzynce();
    expect(skrzynka.map((p) => p.kanal).sort()).toEqual(["push", "sms"]);
    expect(skrzynka.every((p) => p.ref_type === "ogloszenie")).toBe(true);

    // Drugi przebieg crona nie dubluje.
    await admin.rpc("wyslij_zaplanowane");
    expect(await wSkrzynce()).toHaveLength(2);
    const { data: wiersz } = await szefClient.from("ogloszenia_planowane").select("wyslane_at, powiadomienie_id").eq("id", id).single();
    expect(wiersz!.wyslane_at).not.toBeNull();
    expect(wiersz!.powiadomienie_id).not.toBeNull();
  });

  it("anulowane nie wychodzi, a wysłanego nie da się anulować", async () => {
    const { data: id } = await zaplanuj(szefClient);
    expect((await szefClient.rpc("anuluj_ogloszenie", { p_id: id })).error).toBeNull();
    await wyslaneTeraz(id as number);
    expect(await wSkrzynce()).toEqual([]);

    const { data: drugie } = await zaplanuj(szefClient);
    await wyslaneTeraz(drugie as number);
    const { error } = await szefClient.rpc("anuluj_ogloszenie", { p_id: drugie });
    expect(error!.message).toMatch(/juz wyszlo/);
  });

  it("uczestnik nie widzi zaplanowanych", async () => {
    await zaplanuj(szefClient);
    const { data } = await alaClient.from("ogloszenia_planowane").select("id");
    expect(data ?? []).toEqual([]);
  });
});
