import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, signIn, createUser, deleteUser, makeAdmin, type TestUser } from "../helpers/supabase";

// Własna drużyna testowa (numer 9): zasiane drużyny są współdzielone między
// plikami, a liczba członków decyduje tu o zamknięciu głosowania.
let druzyna: string;
let inna: string;
let szef: TestUser;
let szefClient: SupabaseClient;
const ludzie: { user: TestUser; client: SupabaseClient }[] = [];
let obcy: TestUser;

async function przyjmij(u: TestUser, team: string, imie: string) {
  const { error } = await admin.from("profiles").update({ status: "approved", team_id: team, display_name: imie }).eq("id", u.id);
  if (error) throw error;
}

async function resetuj() {
  await admin.from("glosy_kapitan").delete().not("voter_id", "is", null);
  await admin.from("powiadomienia").delete().in("ref_type", ["kapitan", "druzyna"]);
  await admin.from("teams").update({ glosowanie: "nie_rozpoczete", captain_id: null }).not("id", "is", null);
}

beforeAll(async () => {
  const { data: d1 } = await admin.from("teams").insert({ name: "Drużyna 9", slug: `test-kap-${Date.now()}`, numer: 9 }).select("id").single();
  const { data: d2 } = await admin.from("teams").insert({ name: "Drużyna 8", slug: `test-kap2-${Date.now()}`, numer: 8 }).select("id").single();
  druzyna = d1!.id as string;
  inna = d2!.id as string;
  for (const imie of ["Ania", "Bartek", "Celina"]) {
    const user = await createUser(`kap-${imie.toLowerCase()}`);
    await przyjmij(user, druzyna, imie);
    ludzie.push({ user, client: await signIn(user) });
  }
  obcy = await createUser("kap-obcy");
  await przyjmij(obcy, inna, "Obcy");
  szef = await createUser("kap-szef");
  await makeAdmin(szef);
  szefClient = await signIn(szef);
});

afterEach(resetuj);

afterAll(async () => {
  for (const u of [...ludzie.map((l) => l.user), obcy, szef]) await deleteUser(u);
  await admin.from("teams").delete().in("id", [druzyna, inna]);
});

const glos = (i: number, kandydat: string) => ludzie[i].client.rpc("oddaj_glos_na_kapitana", { p_kandydat: kandydat });
const id = (i: number) => ludzie[i].user.id;

describe("drużyny przed głosowaniem", () => {
  it("zasiane drużyny mają nazwy „Drużyna N”, bez motta i kapitana", async () => {
    const { data } = await admin.from("teams").select("name, numer, motto, nazwa_nadana").not("numer", "is", null).lte("numer", 4).order("numer");
    expect(data!.map((t) => t.name)).toEqual(["Drużyna 1", "Drużyna 2", "Drużyna 3", "Drużyna 4"]);
    expect(data!.every((t) => t.motto === null && t.nazwa_nadana === false)).toBe(true);
  });

  it("przed startem nie da się głosować", async () => {
    expect((await glos(0, id(1))).error!.message).toMatch(/Glosowanie nie trwa/);
  });

  it("tylko admin rozpoczyna głosowanie; start wysyła push do drużyny", async () => {
    expect((await ludzie[0].client.rpc("rozpocznij_glosowanie")).error).not.toBeNull();
    const { error } = await szefClient.rpc("rozpocznij_glosowanie");
    expect(error).toBeNull();
    const { data } = await admin.from("powiadomienia").select("adresat, adresat_id").eq("ref_type", "kapitan").eq("adresat_id", druzyna);
    expect(data).toEqual([{ adresat: "team", adresat_id: druzyna }]);
  });
});

describe("głosowanie", () => {
  it("stan pokazuje liczby i mój głos, a nie cudze", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    const { data } = await ludzie[1].client.rpc("stan_glosowania");
    expect(data).toMatchObject({ team_id: druzyna, etap: "trwa", czlonkow: 3, glosow: 1, moj_glos: null });
    const { data: moj } = await ludzie[0].client.rpc("stan_glosowania");
    expect(moj.moj_glos).toBe(id(1));
  });

  it("uczestnik nie czyta tabeli głosów", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    const { data } = await ludzie[1].client.from("glosy_kapitan").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("głos na osobę spoza drużyny odpada", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    expect((await glos(0, obcy.id)).error!.message).toMatch(/spoza twojej druzyny/);
  });

  it("głos można zmienić; ostatni głos zamyka i wybiera kapitana", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(2));
    await glos(0, id(1));
    await glos(1, id(1));
    let { data: t } = await admin.from("teams").select("glosowanie, captain_id").eq("id", druzyna).single();
    expect(t!.glosowanie).toBe("trwa");
    await glos(2, id(2));
    ({ data: t } = await admin.from("teams").select("glosowanie, captain_id").eq("id", druzyna).single());
    expect(t).toEqual({ glosowanie: "zakonczone", captain_id: id(1) });
    const { data: push } = await admin.from("powiadomienia").select("tytul").eq("ref_type", "kapitan").eq("adresat_id", druzyna);
    expect(push!.map((p) => p.tytul)).toContain("Macie kapitana");
  });

  it("remis - kapitanem zostaje jeden z remisujących", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(0));
    await glos(1, id(1));
    await glos(2, id(2));
    const { data: t } = await admin.from("teams").select("captain_id").eq("id", druzyna).single();
    expect([id(0), id(1), id(2)]).toContain(t!.captain_id);
  });

  it("głos osoby przeniesionej do innej drużyny przestaje się liczyć", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    await admin.from("profiles").update({ team_id: inna }).eq("id", id(0));
    const { data } = await ludzie[1].client.rpc("stan_glosowania");
    expect(data).toMatchObject({ czlonkow: 2, glosow: 0 });
    await admin.from("profiles").update({ team_id: druzyna }).eq("id", id(0));
  });

  it("admin zamyka awaryjnie; bez głosów drużyna zostaje bez kapitana", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    expect((await ludzie[0].client.rpc("zamknij_glosowanie_teraz", { p_team: druzyna })).error).not.toBeNull();
    expect((await szefClient.rpc("zamknij_glosowanie_teraz", { p_team: druzyna })).error).toBeNull();
    const { data: t } = await admin.from("teams").select("glosowanie, captain_id").eq("id", druzyna).single();
    expect(t).toEqual({ glosowanie: "zakonczone", captain_id: null });
    expect((await glos(0, id(1))).error!.message).toMatch(/Glosowanie nie trwa/);
  });

  it("drugi start (np. drużyny dodanej później) nie kasuje głosów drużyny, która już głosuje", async () => {
    await szefClient.rpc("rozpocznij_glosowanie");
    await glos(0, id(1));
    await admin.from("teams").update({ glosowanie: "nie_rozpoczete" }).eq("id", inna);
    await szefClient.rpc("rozpocznij_glosowanie");
    const { data } = await ludzie[1].client.rpc("stan_glosowania");
    expect(data).toMatchObject({ glosow: 1 });
  });
});

describe("nazwa od kapitana", () => {
  async function zKapitanem() {
    await admin.from("teams").update({ glosowanie: "zakonczone", captain_id: id(0) }).eq("id", druzyna);
  }
  afterEach(async () => {
    await admin.from("teams").update({ name: "Drużyna 9", motto: null, nazwa_nadana: false }).eq("id", druzyna);
  });

  it("nadaje tylko kapitan", async () => {
    await zKapitanem();
    const { error } = await ludzie[1].client.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Zakon", p_motto: "" });
    expect(error!.message).toMatch(/Nazwe nadaje kapitan/);
  });

  it("kapitan nadaje raz; nazwa i motto się zapisują, drugi raz odpada", async () => {
    await zKapitanem();
    const k = ludzie[0].client;
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "  Zakon Popiołu ", p_motto: "Z prochu" })).error).toBeNull();
    const { data: t } = await admin.from("teams").select("name, motto, nazwa_nadana").eq("id", druzyna).single();
    expect(t).toEqual({ name: "Zakon Popiołu", motto: "Z prochu", nazwa_nadana: true });
    const { error } = await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Inna", p_motto: "" });
    expect(error!.message).toMatch(/NAZWA_JUZ_NADANA/);
    const { data: push } = await admin.from("powiadomienia").select("body").eq("ref_type", "druzyna").eq("adresat_id", druzyna);
    expect(push![0].body).toMatch(/Zakon Popiołu/);
  });

  it("puste, za długie i zajęte nazwy odpadają, a nazwa zostaje odblokowana", async () => {
    await zKapitanem();
    const k = ludzie[0].client;
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "   ", p_motto: "" })).error!.message).toMatch(/NAZWA_DLUGOSC/);
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "x".repeat(31), p_motto: "" })).error!.message).toMatch(/NAZWA_DLUGOSC/);
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Ok", p_motto: "m".repeat(61) })).error!.message).toMatch(/MOTTO_DLUGOSC/);
    expect((await k.rpc("nadaj_nazwe_druzyny", { p_nazwa: "drużyna 8", p_motto: "" })).error!.message).toMatch(/NAZWA_ZAJETA/);
    const { data: t } = await admin.from("teams").select("nazwa_nadana").eq("id", druzyna).single();
    expect(t!.nazwa_nadana).toBe(false);
  });

  it("admin odblokowuje - wraca „Drużyna N”, kapitan może nadać od nowa", async () => {
    await zKapitanem();
    await ludzie[0].client.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Brzydka", p_motto: "" });
    expect((await ludzie[0].client.rpc("odblokuj_nazwe", { p_team: druzyna })).error).not.toBeNull();
    expect((await szefClient.rpc("odblokuj_nazwe", { p_team: druzyna })).error).toBeNull();
    const { data: t } = await admin.from("teams").select("name, motto, nazwa_nadana").eq("id", druzyna).single();
    expect(t).toEqual({ name: "Drużyna 9", motto: null, nazwa_nadana: false });
    expect((await ludzie[0].client.rpc("nadaj_nazwe_druzyny", { p_nazwa: "Ładna", p_motto: "" })).error).toBeNull();
  });
});
