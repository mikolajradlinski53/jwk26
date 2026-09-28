import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  createUser,
  deleteUser,
  makeAdmin,
  firstTeamId,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

type Kategoria = {
  id: string;
  tytul: string;
  status: "otwarta" | "zamknieta" | "ujawniona";
  nominowani: { id: string; nazwa: string }[];
  moj_glos: string | null;
  zwyciezcy: { id: string; nazwa: string }[] | null;
  uzasadnienia: string[] | null;
};

const UZASADNIENIE =
  "Bo na każdej imprezie to właśnie ta osoba pierwsza wchodzi na parkiet, ostatnia z niego schodzi, " +
  "a w międzyczasie zdąży jeszcze zorganizować konkurs karaoke, pogodzić dwie kłócące się drużyny " +
  "i przekonać ochronę ośrodka, że muzyka wcale nie jest za głośno.";

// Trzy osoby głosują, dwie z nich są nominowane; czekający nie jest przyjęty.
let ala: TestUser;
let ola: TestUser;
let ela: TestUser;
let czekajacy: TestUser;
let szef: TestUser;
let alaClient: SupabaseClient;
let olaClient: SupabaseClient;
let elaClient: SupabaseClient;
let czekajacyClient: SupabaseClient;
let szefClient: SupabaseClient;
const kategorie: string[] = [];

beforeAll(async () => {
  const druzyna = await firstTeamId();
  [ala, ola, ela, czekajacy, szef] = await Promise.all([
    createUser("ala-gossip"),
    createUser("ola-gossip"),
    createUser("ela-gossip"),
    createUser("czekajacy-gossip"),
    createUser("szef-gossip"),
  ]);
  await makeAdmin(szef);
  for (const u of [ala, ola, ela]) await ustawJakoZaakceptowany(u, druzyna);
  await admin.from("profiles").update({ display_name: "Ala" }).eq("id", ala.id);
  await admin.from("profiles").update({ display_name: "Ola" }).eq("id", ola.id);

  alaClient = await signIn(ala);
  olaClient = await signIn(ola);
  elaClient = await signIn(ela);
  czekajacyClient = await signIn(czekajacy);
  szefClient = await signIn(szef);
});

afterEach(async () => {
  if (kategorie.length) {
    await admin.from("gossip_categories").delete().in("id", kategorie.splice(0));
  }
  await admin.from("powiadomienia").delete().eq("ref_type", "gossip");
});

afterAll(async () => {
  await Promise.all([ala, ola, ela, czekajacy, szef].map(deleteUser));
});

async function nowaKategoria(nominowani: string[] = [ala.id, ola.id]): Promise<string> {
  const { data, error } = await szefClient.rpc("utworz_kategorie", {
    p_tytul: "Król parkietu",
    p_opis: "Kto rozkręca każdą imprezę?",
    p_nominowani: nominowani,
  });
  if (error) throw error;
  kategorie.push(data as string);
  return data as string;
}

async function glos(client: SupabaseClient, kategoria: string, na: string, tekst = UZASADNIENIE) {
  return client.rpc("oddaj_glos", {
    p_kategoria: kategoria,
    p_nominowany: na,
    p_uzasadnienie: tekst,
  });
}

async function widok(client: SupabaseClient, id: string): Promise<Kategoria> {
  const { data, error } = await client.rpc("gossipy");
  if (error) throw error;
  return (data as Kategoria[]).find((k) => k.id === id)!;
}

describe("kategorie", () => {
  it("uczestnik nie utworzy kategorii", async () => {
    const { error } = await alaClient.rpc("utworz_kategorie", {
      p_tytul: "x",
      p_opis: null,
      p_nominowani: [ala.id, ola.id],
    });
    expect(error!.message).toMatch(/admin/i);
  });

  it("kategoria wymaga co najmniej dwóch przyjętych nominowanych", async () => {
    const jeden = await szefClient.rpc("utworz_kategorie", {
      p_tytul: "x",
      p_opis: null,
      p_nominowani: [ala.id],
    });
    expect(jeden.error!.message).toMatch(/nominowan/);

    // Nieprzyjęty nie może trafić na listę nominowanych.
    const zCzekajacym = await szefClient.rpc("utworz_kategorie", {
      p_tytul: "x",
      p_opis: null,
      p_nominowani: [ala.id, czekajacy.id],
    });
    expect(zCzekajacym.error!.message).toMatch(/nominowan/);
  });
});

describe("głosowanie", () => {
  it("przyjęty głosuje raz, z uzasadnieniem, nie na siebie", async () => {
    const k = await nowaKategoria();

    const naSiebie = await glos(alaClient, k, ala.id);
    expect(naSiebie.error!.message).toMatch(/siebie/);

    const krotkie = await glos(alaClient, k, ola.id, "Bo tak.");
    expect(krotkie.error!.message).toMatch(/200/);

    expect((await glos(alaClient, k, ola.id)).error).toBeNull();

    const drugi = await glos(alaClient, k, ola.id);
    expect(drugi.error!.message).toMatch(/juz oddany/i);

    expect((await widok(alaClient, k)).moj_glos).toBe(ola.id);
  });

  it("czekający na akceptację i niezalogowany nie głosują", async () => {
    const k = await nowaKategoria();
    expect((await glos(czekajacyClient, k, ola.id)).error).not.toBeNull();
    expect((await glos(anonimowy(), k, ola.id)).error).not.toBeNull();
  });

  it("głos tylko na nominowanego i tylko w otwartej kategorii", async () => {
    const k = await nowaKategoria();
    const naObcego = await glos(alaClient, k, ela.id);
    expect(naObcego.error!.message).toMatch(/nominowan/);

    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    const poZamknieciu = await glos(elaClient, k, ola.id);
    expect(poZamknieciu.error!.message).toMatch(/zamknieta|otwart/i);
  });

  it("nikt poza funkcjami nie czyta głosów — autor nie wychodzi do przeglądarki", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id);

    const { data, error } = await alaClient.from("gossip_votes").select("voter_id");
    // Brak grantu SELECT: błąd uprawnień, nie pusta lista — pusta lista byłaby
    // też wynikiem pustej tabeli i niczego by nie dowodziła.
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();

    const w = await widok(alaClient, k);
    expect(JSON.stringify(w)).not.toContain(ela.id);
  });
});

describe("ujawnienie", () => {
  it("przed ujawnieniem nie widać wyników ani uzasadnień", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id);
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });

    const w = await widok(alaClient, k);
    expect(w.status).toBe("zamknieta");
    expect(w.zwyciezcy).toBeNull();
    expect(w.uzasadnienia).toBeNull();
  });

  it("po ujawnieniu widać tylko zwycięzcę i anonimowe uzasadnienia o nim", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id);
    await glos(alaClient, k, ola.id, UZASADNIENIE + " Ala mówi.");
    await glos(olaClient, k, ala.id, UZASADNIENIE + " Ola o Ali.");
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "ujawniona" });

    const w = await widok(elaClient, k);
    expect(w.zwyciezcy).toEqual([{ id: ola.id, nazwa: "Ola" }]);
    expect(w.uzasadnienia).toHaveLength(2);
    // Uzasadnienie o przegranej nie wychodzi — zdradzałoby, ile dostała głosów.
    expect(w.uzasadnienia!.join(" ")).not.toContain("Ola o Ali");
    // Żadnych liczb głosów w odpowiedzi.
    expect(JSON.stringify(w)).not.toMatch(/"glosy"/);
  });

  it("remis daje kilku zwycięzców", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id);
    await glos(olaClient, k, ala.id);
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "ujawniona" });

    const w = await widok(alaClient, k);
    expect(w.zwyciezcy!.map((z) => z.id).sort()).toEqual([ala.id, ola.id].sort());
  });

  it("ujawnienie wymaga zamknięcia i wysyła powiadomienie do wszystkich", async () => {
    const k = await nowaKategoria();
    const zOtwartej = await szefClient.rpc("zmien_status_kategorii", {
      p_kategoria: k,
      p_status: "ujawniona",
    });
    expect(zOtwartej.error).not.toBeNull();

    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "ujawniona" });

    const { data } = await admin
      .from("powiadomienia")
      .select("kanal, adresat, link")
      .eq("ref_type", "gossip")
      .eq("ref_id", k);
    expect(data).toEqual([{ kanal: "push", adresat: "all", link: "/app/gossip" }]);
  });
});

describe("moderacja", () => {
  it("admin widzi autora i ukrywa uzasadnienie — głos dalej się liczy", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id, UZASADNIENIE + " niestosowne");

    const { data: m, error } = await szefClient.rpc("moderacja_gossipow", { p_kategoria: k });
    expect(error).toBeNull();
    const wpis = (m as { id: string; autor: string; tekst: string }[])[0];
    expect(wpis.autor).toBeTruthy();

    expect((await szefClient.rpc("ukryj_uzasadnienie", { p_glos: wpis.id, p_ukryte: true })).error).toBeNull();

    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "ujawniona" });
    const w = await widok(alaClient, k);
    expect(w.zwyciezcy).toEqual([{ id: ola.id, nazwa: "Ola" }]);
    expect(w.uzasadnienia).toEqual([]);
  });

  it("uczestnik nie zajrzy do moderacji", async () => {
    const k = await nowaKategoria();
    const { error } = await alaClient.rpc("moderacja_gossipow", { p_kategoria: k });
    expect(error!.message).toMatch(/admin/i);
  });
});
