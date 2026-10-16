import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  idKadry,
  ustawJakoZaakceptowany,
  dosypPunkty,
  nowaPozycja,
  type TestUser,
} from "../helpers/supabase";

// Kadra (2026-10-15): ukryta drużyna adminów. Każdy admin jest w niej
// kapitanem, a reszta apki jej nie widzi - ranking, kronika, głosowanie,
// przydział, klątwy.
let szef: TestUser;
let uczestnik: TestUser;
let szefClient: SupabaseClient;
let uczestnikClient: SupabaseClient;
let kadra: string;
let druzyna: string;
const pozycje: string[] = [];

beforeAll(async () => {
  [kadra, [druzyna]] = await Promise.all([idKadry(), idDruzyn()]);
  [szef, uczestnik] = await Promise.all([createUser("szef-kadra"), createUser("uczestnik-kadra")]);
  await makeAdmin(szef);
  await ustawJakoZaakceptowany(szef, kadra);
  await ustawJakoZaakceptowany(uczestnik, druzyna);
  szefClient = await signIn(szef);
  uczestnikClient = await signIn(uczestnik);
});

afterAll(async () => {
  await admin.from("shop_orders").delete().in("item_id", pozycje);
  await admin.from("points_ledger").delete().eq("team_id", kadra);
  await admin.from("shop_items").delete().in("id", pozycje);
  await Promise.all([szef, uczestnik].map(deleteUser));
});

describe("Kadra", () => {
  it("jest jedna, ukryta i nie ma głosowania", async () => {
    const { data } = await admin.from("teams").select("name, ukryta, glosowanie, nazwa_nadana").eq("ukryta", true);
    expect(data).toEqual([{ name: "Kadra", ukryta: true, glosowanie: "zakonczone", nazwa_nadana: true }]);
  });

  it("ranking oznacza ją jako ukrytą, kronika sklepiku jej nie pokazuje", async () => {
    const { data } = await uczestnikClient.from("team_scores").select("team_id, ukryta").eq("team_id", kadra).single();
    expect(data!.ukryta).toBe(true);

    const id = await nowaPozycja({ name: "Test Kadry", kind: "physical", price: 1 });
    pozycje.push(id);
    await dosypPunkty(kadra, 10);
    const { error } = await szefClient.rpc("kup_z_polki", { p_item_id: id });
    expect(error).toBeNull();

    const { data: kronika } = await uczestnikClient.from("kronika_sklepiku").select("item_name").eq("item_name", "Test Kadry");
    expect(kronika ?? []).toEqual([]);
  });

  it("każdy admin w Kadrze jest kapitanem, uczestnik w swojej drużynie nie", async () => {
    expect((await szefClient.rpc("is_captain", { p_team: kadra })).data).toBe(true);
    expect((await uczestnikClient.rpc("is_captain", { p_team: druzyna })).data).toBe(false);
    expect((await uczestnikClient.rpc("is_captain", { p_team: kadra })).data).toBe(false);
  });

  it("Kadra nie rzuca klątw i nie da się w nią celować", async () => {
    const id = await nowaPozycja({ name: "Klątwa testowa Kadry", kind: "physical", price: 1, requires_target: true });
    pozycje.push(id);
    const zKadry = await admin
      .from("shop_orders")
      .insert({ team_id: kadra, item_id: id, price_paid: 1, ordered_by: szef.id, target_team_id: druzyna });
    expect(zKadry.error!.message).toMatch(/Kadra/);
    const wKadre = await admin
      .from("shop_orders")
      .insert({ team_id: druzyna, item_id: id, price_paid: 1, ordered_by: uczestnik.id, target_team_id: kadra });
    expect(wKadre.error!.message).toMatch(/Kadra/);
  });

  it("do Kadry nie trafi uczestnik - ani przydziałem, ani bezpośrednio", async () => {
    const { error } = await szefClient.rpc("przydziel_druzyne", { p_user: uczestnik.id, p_team: kadra });
    expect(error!.message).toMatch(/Kadry/);
    const wprost = await admin.from("profiles").update({ team_id: kadra }).eq("id", uczestnik.id);
    expect(wprost.error!.message).toMatch(/Kadry/);
  });

  it("start głosowania omija Kadrę, nawet z cofniętym etapem", async () => {
    await admin.from("teams").update({ glosowanie: "nie_rozpoczete" }).eq("id", kadra);
    try {
      // Pozostałe drużyny są już po starcie albo po głosowaniu - ruszyć mogłaby tylko Kadra.
      const { data: zPrzed } = await admin.from("teams").select("id, glosowanie").eq("ukryta", false);
      await admin.from("teams").update({ glosowanie: "zakonczone" }).eq("ukryta", false).eq("glosowanie", "nie_rozpoczete");
      const { data: ile, error } = await szefClient.rpc("rozpocznij_glosowanie");
      expect(error).toBeNull();
      expect(ile).toBe(0);
      for (const t of zPrzed ?? []) await admin.from("teams").update({ glosowanie: t.glosowanie }).eq("id", t.id);
    } finally {
      await admin.from("teams").update({ glosowanie: "zakonczone" }).eq("id", kadra);
    }
  });

  it("admin w Kadrze nie ma karty głosowania", async () => {
    const { data } = await szefClient.rpc("stan_glosowania");
    expect(data).toBeNull();
    const { data: postep } = await szefClient.rpc("postep_glosowania");
    expect((postep as { team_id: string }[]).map((p) => p.team_id)).not.toContain(kadra);
  });

  it("admin w Kadrze gra w kasynie ze stałej puli", async () => {
    const { data } = await szefClient.rpc("pula_kasyna");
    expect(data).toMatchObject({ limit: 300 });
  });
});
