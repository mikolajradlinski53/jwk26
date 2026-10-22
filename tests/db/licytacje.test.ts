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

  it("w ciemno: uczestnik nie odczyta przedmiotu prosto z tabel", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100, wCiemno: true });
    const { data } = await czlonekClient.from("licytacje").select("item_id").eq("id", id);
    expect(data ?? []).toEqual([]);
  });

  it("zakup z półki jest wyłączony", async () => {
    await ustawSaldo(A, 500);
    const { error } = await kapAClient.rpc("kup_z_polki", { p_item_id: await przedmiot() });
    expect(error?.message).toMatch(/SKLEPIK_ZAMKNIETY/);
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

/** Przesuwa koniec licytacji w przeszłość i odpala tick kluczem serwisowym. */
async function zamknij(id: string) {
  const teraz = Date.now();
  await admin
    .from("licytacje")
    .update({ start: new Date(teraz - 120_000).toISOString(), koniec: new Date(teraz - 1_000).toISOString() })
    .eq("id", id);
  const { error } = await admin.rpc("licytacje_tick");
  if (error) throw error;
}

async function stan(id: string) {
  const { data } = await admin.from("licytacje").select("status, zwyciezca_team, cena_koncowa, order_id").eq("id", id).single();
  return data!;
}

async function wpisyLicytacji(team: string) {
  const { data } = await admin.from("points_ledger").select("delta").eq("team_id", team).eq("category", "licytacja");
  return data ?? [];
}

describe("licytacje: zamknięcie i wygrana", () => {
  it("najwyższa oferta wygrywa, jeden wpis w księdze nawet przy drugim ticku", async () => {
    await Promise.all([ustawSaldo(A, 500), ustawSaldo(B, 500)]);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await licytuj(kapAClient, id, 100);
    await licytuj(kapBClient, id, 120);
    await zamknij(id);
    await admin.rpc("licytacje_tick");
    expect(await stan(id)).toMatchObject({ status: "zamknieta", zwyciezca_team: B, cena_koncowa: 120 });
    expect(await wpisyLicytacji(B)).toEqual([{ delta: -120 }]);
    expect(await wpisyLicytacji(A)).toEqual([]);
  });

  it("lider bez pokrycia oddaje przedmiot kolejnej ofercie", async () => {
    await Promise.all([ustawSaldo(A, 500), ustawSaldo(B, 500)]);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await licytuj(kapAClient, id, 100);
    await licytuj(kapBClient, id, 120);
    await ustawSaldo(B, 50);
    await zamknij(id);
    expect(await stan(id)).toMatchObject({ zwyciezca_team: A, cena_koncowa: 100 });
    expect(await wpisyLicytacji(B)).toEqual([]);
  });

  it("nikt nie może zapłacić - bez zwycięzcy", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await licytuj(kapAClient, id, 100);
    await ustawSaldo(A, 10);
    await zamknij(id);
    expect(await stan(id)).toMatchObject({ status: "zamknieta", zwyciezca_team: null, order_id: null });
    expect(await wpisyLicytacji(A)).toEqual([]);
  });

  it("bez ofert - bez zwycięzcy, z ogłoszeniem", async () => {
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await zamknij(id);
    expect(await stan(id)).toMatchObject({ status: "zamknieta", zwyciezca_team: null });
    const { data } = await admin.from("powiadomienia").select("tytul, body").eq("ref_id", id).eq("adresat", "all");
    expect(data!.some((p) => /bez zwyci/i.test(p.body ?? ""))).toBe(true);
  });

  it("Błogosławieństwo włącza się zwycięzcy", async () => {
    await ustawSaldo(A, 500);
    const item = await przedmiot({ kind: "digital", effect_key: "blogoslawienstwo", effect_value: 2 });
    const id = await nowaLicytacja({ itemId: item, cena: 100 });
    await licytuj(kapAClient, id, 100);
    await zamknij(id);
    const { order_id } = await stan(id);
    const { data: z } = await admin.from("shop_orders").select("status, team_id, price_paid").eq("id", order_id).single();
    expect(z).toEqual({ status: "fulfilled", team_id: A, price_paid: 100 });
    const { data: e } = await admin.from("active_effects").select("subject_id, effect_key").eq("order_id", order_id);
    expect(e).toEqual([{ subject_id: A, effect_key: "blogoslawienstwo" }]);
  });

  it("nagroda fizyczna trafia do kolejki wydań", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await licytuj(kapAClient, id, 100);
    await zamknij(id);
    const { data: z } = await admin.from("shop_orders").select("status").eq("id", (await stan(id)).order_id).single();
    expect(z!.status).toBe("pending");
  });

  async function wygranaKlatwa(): Promise<string> {
    await ustawSaldo(A, 500);
    const item = await przedmiot({ kind: "digital", effect_key: "klatwa", effect_value: 30, requires_target: true });
    const id = await nowaLicytacja({ itemId: item, cena: 100 });
    await licytuj(kapAClient, id, 100);
    await zamknij(id);
    return (await stan(id)).order_id as string;
  }

  it("Klątwa: kapitan zwycięzcy wybiera ofiarę po wygranej", async () => {
    const order = await wygranaKlatwa();
    const { data: przed } = await admin.from("shop_orders").select("status, target_team_id").eq("id", order).single();
    expect(przed).toEqual({ status: "pending", target_team_id: null });
    await ustawSaldo(C, 200);
    expect((await kapAClient.rpc("rzuc_klatwe", { p_order: order, p_target: A })).error?.message).toMatch(/ZLY_CEL/);
    expect((await kapAClient.rpc("rzuc_klatwe", { p_order: order, p_target: C })).error).toBeNull();
    expect(await saldoDruzyny(C)).toBe(170);
    const { data: po } = await admin.from("shop_orders").select("status, target_team_id").eq("id", order).single();
    expect(po).toEqual({ status: "fulfilled", target_team_id: C });
    expect((await kapAClient.rpc("rzuc_klatwe", { p_order: order, p_target: C })).error?.message).toMatch(/ZAMOWIENIE_NIEAKTYWNE/);
  });

  it("Klątwa: obcy kapitan nie rzuci, admin rzuci za zwycięzcę", async () => {
    const order = await wygranaKlatwa();
    expect((await kapBClient.rpc("rzuc_klatwe", { p_order: order, p_target: C })).error?.message).toMatch(/BRAK_UPRAWNIEN/);
    expect((await szefClient.rpc("rzuc_klatwe", { p_order: order, p_target: C })).error).toBeNull();
  });

  it("Klątwa: Tarcza ofiary pochłania rzut", async () => {
    const order = await wygranaKlatwa();
    await ustawSaldo(C, 200);
    const { data: tarcza } = await admin
      .from("active_effects")
      .insert({ scope: "team", subject_id: C, effect_key: "tarcza" })
      .select("id")
      .single();
    expect((await kapAClient.rpc("rzuc_klatwe", { p_order: order, p_target: C })).error).toBeNull();
    expect(await saldoDruzyny(C)).toBe(200);
    const { data: t } = await admin.from("active_effects").select("consumed_at").eq("id", tarcza!.id).single();
    expect(t!.consumed_at).not.toBeNull();
  });

  it("otwarcie ogłoszone raz; w ciemno bez nazwy przedmiotu", async () => {
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100, wCiemno: true });
    await admin.rpc("licytacje_tick");
    await admin.rpc("licytacje_tick");
    const { data } = await admin.from("powiadomienia").select("tytul, body").eq("ref_id", id).eq("adresat", "all");
    expect(data).toHaveLength(1);
    expect(data![0].tytul).toBe("Licytacja otwarta");
    expect(data![0].body).not.toMatch(/Licytowany przedmiot/);
  });

  it("jedna licytacja z błędem nie blokuje zamknięcia pozostałych", async () => {
    // Saldo A ponad zakres integer - liczenie salda przy zamknięciu rzuci
    // wyjątkiem (zamiennik dowolnej awarii jednej licytacji z produkcji).
    await ustawSaldo(A, 0);
    await dosypPunkty(A, 1_500_000_000);
    await dosypPunkty(A, 1_500_000_000);
    const zepsuta = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    const dobra = await nowaLicytacja({ itemId: await przedmiot(), cena: 100 });
    await admin.from("licytacje_oferty").insert({ licytacja_id: zepsuta, team_id: A, user_id: kapA.id, kwota: 100 });
    const teraz = Date.now();
    await admin
      .from("licytacje")
      .update({ start: new Date(teraz - 120_000).toISOString(), koniec: new Date(teraz - 1_000).toISOString() })
      .in("id", [zepsuta, dobra]);
    expect((await admin.rpc("licytacje_tick")).error).toBeNull();
    expect((await stan(dobra)).status).toBe("zamknieta");
    expect((await stan(zepsuta)).status).toBe("trwa");
    expect(await wpisyLicytacji(A)).toEqual([]);
  });

  it("po zamknięciu licytacji w ciemno nazwa jest jawna", async () => {
    await ustawSaldo(A, 500);
    const id = await nowaLicytacja({ itemId: await przedmiot(), cena: 100, wCiemno: true });
    await licytuj(kapAClient, id, 100);
    await zamknij(id);
    const { data } = await czlonekClient.rpc("licytacje_lista");
    expect((data as Record<string, unknown>[]).find((r) => r.id === id)!.nazwa).toBe("Licytowany przedmiot");
  });
});
