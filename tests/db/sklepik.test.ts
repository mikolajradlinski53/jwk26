import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  createUser,
  deleteUser,
  idDruzyn,
  ustawKapitana,
  ustawJakoZaakceptowany,
  dosypPunkty,
  saldoDruzyny,
  nowaPozycja,
  sprzatnijSklepik,
  sprzatanieUzytkownikow,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Kapitan i szeregowy członek tej samej drużyny, zalogowani raz na cały plik.
// Projekt testowy dopuszcza 30 logowań na 5 minut, a testów tu kilkanaście.
let kapitan: TestUser;
let szeregowy: TestUser;
let kapitanClient: SupabaseClient;
let szeregowyClient: SupabaseClient;
let mojaDruzyna: string;
let obcaDruzyna: string;

beforeAll(async () => {
  const druzyny = await idDruzyn();
  mojaDruzyna = druzyny[0];
  obcaDruzyna = druzyny[1];

  kapitan = await createUser("kapitan-sklep");
  szeregowy = await createUser("szeregowy-sklep");
  await ustawJakoZaakceptowany(kapitan, mojaDruzyna);
  await ustawJakoZaakceptowany(szeregowy, mojaDruzyna);
  await ustawKapitana(mojaDruzyna, kapitan.id);

  kapitanClient = await signIn(kapitan);
  szeregowyClient = await signIn(szeregowy);
});

afterAll(async () => {
  // Drużyny są zasiane na stałe i współdzielone między plikami testowymi, więc
  // kapitana trzeba zdjąć jawnie. FK ma `on delete set null`, ale kasowanie
  // użytkownika zdejmie go dopiero po tym, jak inny plik zdąży już zobaczyć
  // drużynę z kapitanem, którego nie zna.
  await ustawKapitana(mojaDruzyna, null);
  await deleteUser(kapitan);
  await deleteUser(szeregowy);
});

afterEach(async () => {
  await sprzatnijSklepik();
  await posprzataj();
});

describe("półka", () => {
  it("migracja zasiewa jedenaście pozycji, w tym trzy cyfrowe", async () => {
    const { data, error } = await admin
      .from("shop_items")
      .select("name, kind, effect_key")
      .neq("description", "pozycja testowa");
    expect(error).toBeNull();
    expect(data).toHaveLength(11);

    const cyfrowe = data!.filter((i) => i.kind === "digital");
    expect(cyfrowe.map((i) => i.effect_key).sort()).toEqual([
      "blogoslawienstwo",
      "klatwa",
      "tarcza",
    ]);

    // Pozycja fizyczna z kluczem efektu byłaby cicho martwym efektem — więzy
    // w schemacie mają tego nie dopuścić.
    const fizyczne = data!.filter((i) => i.kind === "physical");
    expect(fizyczne.every((i) => i.effect_key === null)).toBe(true);
  });

  it("zaakceptowany widzi półkę, niezalogowany nie", async () => {
    const { data: widziane } = await kapitanClient.from("shop_items").select("id");
    expect((widziane ?? []).length).toBeGreaterThan(0);

    const { data: obce } = await anonimowy().from("shop_items").select("id");
    expect(obce ?? []).toEqual([]);
  });

  it("uczestnik nie dopisze zamówienia wprost do tabeli", async () => {
    const itemId = await nowaPozycja({ name: "Test RLS", kind: "physical", price: 10 });

    const { error } = await kapitanClient.from("shop_orders").insert({
      team_id: mojaDruzyna,
      item_id: itemId,
      price_paid: 10,
      ordered_by: kapitan.id,
    });

    expect(error).not.toBeNull();

    const { data } = await admin.from("shop_orders").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("pozycja fizyczna z kluczem efektu nie przejdzie", async () => {
    const { error } = await admin.from("shop_items").insert({
      name: "Sprzeczna",
      description: "pozycja testowa",
      kind: "physical",
      price: 10,
      effect_key: "klatwa",
    });
    expect(error).not.toBeNull();
  });
});

describe("zakup pozycji fizycznej", () => {
  it("nie-kapitan nie kupi", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({ name: "Test Kielich", kind: "physical", price: 40 });

    const { error } = await szeregowyClient.rpc("kup_z_polki", { p_item_id: itemId });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/kapitan/i);

    const { data } = await admin.from("shop_orders").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("niezalogowany nie wywoła funkcji", async () => {
    const itemId = await nowaPozycja({ name: "Test Anon", kind: "physical", price: 40 });

    const { error } = await anonimowy().rpc("kup_z_polki", { p_item_id: itemId });

    expect(error).not.toBeNull();
    // Gdyby grant dla roli anon został, funkcja weszłaby i padła na strażniku
    // is_approved() — komunikatem o akceptacji. Cokolwiek innego dowodzi,
    // że `revoke ... from anon` zadziałał.
    expect(error!.message).not.toMatch(/zaakceptowan/i);
  });

  it("kapitan kupuje: zamówienie pending, punkty zdjęte z drużyny", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const przed = await saldoDruzyny(mojaDruzyna);
    const itemId = await nowaPozycja({
      name: "Test Manna",
      kind: "physical",
      price: 220,
      stock: 3,
    });

    const { data: orderId, error } = await kapitanClient.rpc("kup_z_polki", {
      p_item_id: itemId,
    });
    expect(error).toBeNull();
    expect(orderId).toBeTruthy();

    const { data: zam } = await admin
      .from("shop_orders")
      .select("team_id, price_paid, status, ordered_by, target_team_id")
      .eq("id", orderId)
      .single();
    expect(zam!.status).toBe("pending");
    expect(zam!.price_paid).toBe(220);
    expect(zam!.team_id).toBe(mojaDruzyna);
    expect(zam!.ordered_by).toBe(kapitan.id);
    expect(zam!.target_team_id).toBeNull();

    expect(await saldoDruzyny(mojaDruzyna)).toBe(przed - 220);

    // Wydatek drużynowy ma user_id NULL, żeby nie obciążał indywidualnego
    // wyniku kapitana (D2 specu głównego).
    const { data: wpis } = await admin
      .from("points_ledger")
      .select("user_id, delta, category, ref_id")
      .eq("category", "sklepik")
      .single();
    expect(wpis!.user_id).toBeNull();
    expect(wpis!.delta).toBe(-220);
    expect(wpis!.ref_id).toBe(orderId);

    const { data: poz } = await admin
      .from("shop_items")
      .select("stock")
      .eq("id", itemId)
      .single();
    expect(poz!.stock).toBe(2);
  });

  it("zakup ponad saldo odbija się", async () => {
    await dosypPunkty(mojaDruzyna, 100);
    const itemId = await nowaPozycja({ name: "Test Droga", kind: "physical", price: 250 });

    const { error } = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/kosztuje/i);
    expect(await saldoDruzyny(mojaDruzyna)).toBe(100);
  });

  it("stan schodzi do zera i dalsze zakupy odbijają się", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({
      name: "Test Ostatnia",
      kind: "physical",
      price: 40,
      stock: 1,
    });

    const pierwszy = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });
    expect(pierwszy.error).toBeNull();

    const drugi = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });
    expect(drugi.error).not.toBeNull();
    expect(drugi.error!.message).toMatch(/ostatnia sztuka/i);

    const { data: poz } = await admin
      .from("shop_items")
      .select("stock")
      .eq("id", itemId)
      .single();
    expect(poz!.stock).toBe(0);
  });

  it("pozycja nieaktywna jest niedostępna", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({ name: "Test Zdjeta", kind: "physical", price: 40 });
    await admin.from("shop_items").update({ active: false }).eq("id", itemId);

    const { error } = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/niedostepna/i);
  });

  it("stan bez limitu nie schodzi poniżej niczego", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({
      name: "Test Bezlimitu",
      kind: "physical",
      price: 40,
      stock: null,
    });

    const a = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });
    const b = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    const { data: poz } = await admin
      .from("shop_items")
      .select("stock")
      .eq("id", itemId)
      .single();
    expect(poz!.stock).toBeNull();
  });

  it("zakup dopisuje wiersz do outboxu dla admina", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({ name: "Test Outbox", kind: "physical", price: 40 });

    const { data: orderId } = await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });

    const { data: p } = await admin
      .from("powiadomienia")
      .select("adresat, adresat_id, ref_type, ref_id, wyslane_at")
      .eq("ref_id", orderId);
    expect(p).toHaveLength(1);
    expect(p![0].adresat).toBe("admin");
    expect(p![0].adresat_id).toBeNull();
    expect(p![0].ref_type).toBe("shop_order");
    // Nikt outboxu w tym kroku nie opróżnia — transport powstaje w kroku 8.
    expect(p![0].wyslane_at).toBeNull();
  });

  it("uczestnik nie czyta outboxu", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({ name: "Test Skrytka", kind: "physical", price: 40 });
    await kapitanClient.rpc("kup_z_polki", { p_item_id: itemId });

    const { data } = await kapitanClient.from("powiadomienia").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("dwa równoległe zakupy na granicy salda: jeden przechodzi, drugi odbija", async () => {
    // Saldo wystarcza na dokładnie jedną sztukę. To jest ten test, dla którego
    // istnieje blokada wiersza `teams` — bez niej oba wywołania przeczytają to
    // samo saldo, oba przejdą, a drużyna zjedzie pod zero. Ledger jest tylko do
    // dopisywania, więc nie ma jak tego cofnąć.
    await dosypPunkty(mojaDruzyna, 220);
    const itemId = await nowaPozycja({
      name: "Test Wyscig",
      kind: "physical",
      price: 220,
      stock: 5,
    });

    const [a, b] = await Promise.all([
      kapitanClient.rpc("kup_z_polki", { p_item_id: itemId }),
      kapitanClient.rpc("kup_z_polki", { p_item_id: itemId }),
    ]);

    const udane = [a, b].filter((r) => r.error === null);
    const odbite = [a, b].filter((r) => r.error !== null);
    expect(udane).toHaveLength(1);
    expect(odbite).toHaveLength(1);
    expect(odbite[0].error!.message).toMatch(/kosztuje/i);

    // Najważniejsza asercja w całym pliku: saldo nie jest ujemne.
    expect(await saldoDruzyny(mojaDruzyna)).toBe(0);

    const { data: zam } = await admin.from("shop_orders").select("id");
    expect(zam).toHaveLength(1);
  });

  it("dwa równoległe zakupy ostatniej sztuki nie sprzedadzą jej dwa razy", async () => {
    await dosypPunkty(mojaDruzyna, 500);
    const itemId = await nowaPozycja({
      name: "Test Wyscig stanu",
      kind: "physical",
      price: 40,
      stock: 1,
    });

    const [a, b] = await Promise.all([
      kapitanClient.rpc("kup_z_polki", { p_item_id: itemId }),
      kapitanClient.rpc("kup_z_polki", { p_item_id: itemId }),
    ]);

    expect([a, b].filter((r) => r.error === null)).toHaveLength(1);

    const { data: poz } = await admin
      .from("shop_items")
      .select("stock")
      .eq("id", itemId)
      .single();
    expect(poz!.stock).toBe(0);
  });
});
