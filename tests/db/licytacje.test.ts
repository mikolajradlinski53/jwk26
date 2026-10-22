import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  idKadry,
  ustawKapitana,
  ustawJakoZaakceptowany,
  saldoDruzyny,
  dosypPunkty,
  nowaPozycja,
  nowaLicytacja,
  sprzatnijSklepik,
  type TestUser,
} from "../helpers/supabase";

// Licytacje (2026-10-22): kapitanowie drużyn przebijają się punktami drużyny.
// Trzy jawne drużyny: A i B licytują, C bywa ofiarą Klątwy.
let A: string, B: string, C: string;
let kapA: TestUser, kapB: TestUser, kapC: TestUser, czlonekA: TestUser, szef: TestUser;
let kapAClient: SupabaseClient, kapBClient: SupabaseClient, kapCClient: SupabaseClient;
let czlonekClient: SupabaseClient, szefClient: SupabaseClient;
let poprzedniKapitanowie: (string | null)[] = [];

/** Ustawia saldo drużyny na dokładnie `ile` pkt wpisem testowym. */
async function ustawSaldo(team: string, ile: number) {
  const jest = await saldoDruzyny(team);
  if (jest !== ile) await dosypPunkty(team, ile - jest);
}

beforeAll(async () => {
  [A, B, C] = await idDruzyn();
  const { data: kap } = await admin.from("teams").select("id, captain_id").in("id", [A, B, C]).order("name");
  poprzedniKapitanowie = (kap ?? []).map((t) => t.captain_id as string | null);
  [kapA, kapB, kapC, czlonekA, szef] = await Promise.all(
    ["kap-a-lic", "kap-b-lic", "kap-c-lic", "czlonek-lic", "szef-lic"].map((t) => createUser(t)),
  );
  await Promise.all([
    ustawJakoZaakceptowany(kapA, A),
    ustawJakoZaakceptowany(czlonekA, A),
    ustawJakoZaakceptowany(kapB, B),
    ustawJakoZaakceptowany(kapC, C),
  ]);
  await Promise.all([ustawKapitana(A, kapA.id), ustawKapitana(B, kapB.id), ustawKapitana(C, kapC.id)]);
  await makeAdmin(szef);
  await admin.from("profiles").update({ team_id: await idKadry() }).eq("id", szef.id);
  [kapAClient, kapBClient, kapCClient, czlonekClient, szefClient] = await Promise.all(
    [kapA, kapB, kapC, czlonekA, szef].map(signIn),
  );
});

afterEach(async () => {
  await admin.from("licytacje").delete().not("id", "is", null);
  await admin.from("points_ledger").delete().in("category", ["licytacja"]);
  await sprzatnijSklepik();
});

afterAll(async () => {
  await Promise.all([A, B, C].map((t, i) => ustawKapitana(t, poprzedniKapitanowie[i] ?? null)));
  await Promise.all([kapA, kapB, kapC, czlonekA, szef].map(deleteUser));
});

async function przedmiot(o: { kind?: "digital" | "physical"; effect_key?: string; effect_value?: number; requires_target?: boolean } = {}) {
  return nowaPozycja({
    name: "Licytowany przedmiot",
    kind: o.kind ?? "physical",
    price: 50,
    effect_key: o.effect_key ?? null,
    effect_value: o.effect_value ?? null,
    requires_target: o.requires_target ?? false,
  });
}

const licytuj = (c: SupabaseClient, id: string, kwota: number) => c.rpc("licytuj", { p_licytacja: id, p_kwota: kwota });

describe("licytacje: oferty", () => {
  it("pierwsza oferta poniżej ceny wywoławczej odrzucona", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    expect((await licytuj(kapAClient, id, 99)).error?.message).toMatch(/ZA_MALO/);
    expect((await licytuj(kapAClient, id, 100)).error).toBeNull();
  });

  it("przebicie wymaga kroku", async () => {
    await Promise.all([ustawSaldo(A, 500), ustawSaldo(B, 500)]);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    expect((await licytuj(kapAClient, id, 100)).error).toBeNull();
    expect((await licytuj(kapBClient, id, 105)).error?.message).toMatch(/ZA_MALO/);
    expect((await licytuj(kapBClient, id, 110)).error).toBeNull();
  });

  it("ta sama kwota od dwóch drużyn - druga odrzucona", async () => {
    await Promise.all([ustawSaldo(A, 500), ustawSaldo(B, 500)]);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    expect((await licytuj(kapAClient, id, 100)).error).toBeNull();
    expect((await licytuj(kapBClient, id, 100)).error?.message).toMatch(/ZA_MALO/);
  });

  it("prowadzący nie przebija siebie", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await licytuj(kapAClient, id, 100);
    expect((await licytuj(kapAClient, id, 120)).error?.message).toMatch(/JUZ_PROWADZICIE/);
  });

  it("licytuje tylko kapitan drużyny jawnej", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    expect((await licytuj(czlonekClient, id, 100)).error?.message).toMatch(/NIE_KAPITAN/);
    expect((await licytuj(szefClient, id, 100)).error?.message).toMatch(/NIE_KAPITAN/);
  });

  it("prowadzące oferty blokują punkty", async () => {
    await Promise.all([ustawSaldo(A, 150), ustawSaldo(B, 500)]);
    const X = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    const Y = await nowaLicytacja({ itemId: await przedmiot(), cena: 60 });
    expect((await licytuj(kapAClient, X, 100)).error).toBeNull();
    expect((await licytuj(kapAClient, Y, 60)).error?.message).toMatch(/BRAK_PUNKTOW/);
    expect((await kapAClient.rpc("dostepne_saldo", { p_team: A })).data).toBe(50);

    expect((await licytuj(kapBClient, X, 110)).error).toBeNull();
    expect((await kapAClient.rpc("dostepne_saldo", { p_team: A })).data).toBe(150);
    expect((await licytuj(kapAClient, Y, 60)).error).toBeNull();
  });

  it("po końcu i przed startem oferta odrzucona", async () => {
    await ustawSaldo(A, 500);
    const item = await przedmiot();
    const { data: stara } = await admin
      .from("licytacje")
      .insert({
        item_id: item,
        cena_wywolawcza: 10,
        start: new Date(Date.now() - 7_200_000).toISOString(),
        koniec: new Date(Date.now() - 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    expect((await licytuj(kapAClient, stara!.id, 10)).error?.message).toMatch(/LICYTACJA_NIEAKTYWNA/);
    const przyszla = await nowaLicytacja({ itemId: item, cena: 10, startZa: 30, koniecZa: 60 });
    expect((await licytuj(kapAClient, przyszla, 10)).error?.message).toMatch(/LICYTACJA_NIEAKTYWNA/);
  });

  it("przebita drużyna dostaje powiadomienie", async () => {
    await Promise.all([ustawSaldo(A, 500), ustawSaldo(B, 500)]);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await licytuj(kapAClient, id, 100);
    await licytuj(kapBClient, id, 110);
    const { data } = await admin
      .from("powiadomienia")
      .select("kanal, adresat, adresat_id, tytul, link")
      .eq("ref_type", "licytacja")
      .eq("ref_id", id)
      .eq("adresat", "team");
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ kanal: "push", adresat_id: A, link: "/app/sklep" });
    expect(data![0].tytul).toMatch(/przebito/i);
  });

  it("w ciemno uczestnik nie widzi przedmiotu, admin widzi", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100, wCiemno: true });
    await licytuj(kapAClient, id, 100);
    const { data: u } = await czlonekClient.rpc("licytacje_lista");
    const wiersz = (u as Record<string, unknown>[]).find((r) => r.id === id)!;
    expect(wiersz).toMatchObject({ nazwa: null, opis: null, grafika: null, ikona: null, efekt: null, najwyzsza: 100, prowadzi_team: A });
    const { data: a } = await szefClient.rpc("licytacje_lista");
    expect((a as Record<string, unknown>[]).find((r) => r.id === id)!.nazwa).toBe("Licytowany przedmiot");
  });

  it("uczestnik nie wstawi oferty ani licytacji z pominięciem funkcji", async () => {
    const item = await przedmiot();
    const id = await nowaLicytacja({ itemId: item, cena: 100 });
    const oferta = await kapAClient
      .from("licytacje_oferty")
      .insert({ licytacja_id: id, team_id: A, user_id: kapA.id, kwota: 1 });
    expect(oferta.error).not.toBeNull();
    const licytacja = await kapAClient
      .from("licytacje")
      .insert({ item_id: item, cena_wywolawcza: 1, koniec: new Date(Date.now() + 60_000).toISOString() });
    expect(licytacja.error).not.toBeNull();
  });
});
