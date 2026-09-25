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
