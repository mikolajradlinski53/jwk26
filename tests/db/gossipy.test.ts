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
  moj_glos: string | null;
  moj_typ: string | null;
  zwyciezcy: { id: string; nazwa: string }[] | null;
  uzasadnienia: { tekst: string; zdjecie: string | null }[] | null;
};

const UZASADNIENIE =
  "Bo na każdej imprezie to właśnie ta osoba pierwsza wchodzi na parkiet, ostatnia z niego schodzi, " +
  "a w międzyczasie zdąży jeszcze zorganizować konkurs karaoke, pogodzić dwie kłócące się drużyny " +
  "i przekonać ochronę ośrodka, że muzyka wcale nie jest za głośno.";

// Najmniejszy poprawny JPEG nie jest potrzebny - bucket sprawdza typ z nagłówka
// żądania, nie zawartość.
const ZDJECIE = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

// Trzech przyjętych nominuje; czekający nie jest przyjęty.
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
const pliki: string[] = [];

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
  if (pliki.length) await admin.storage.from("gossip").remove(pliki.splice(0));
  if (kategorie.length) {
    await admin.from("gossip_categories").delete().in("id", kategorie.splice(0));
  }
  await admin.from("powiadomienia").delete().eq("ref_type", "gossip");
});

afterAll(async () => {
  await Promise.all([ala, ola, ela, czekajacy, szef].map(deleteUser));
});

async function nowaKategoria(): Promise<string> {
  const { data, error } = await szefClient.rpc("utworz_kategorie", {
    p_tytul: "Król parkietu",
    p_opis: "Kto rozkręca każdą imprezę?",
  });
  if (error) throw error;
  kategorie.push(data as string);
  return data as string;
}

async function glos(
  client: SupabaseClient,
  kategoria: string,
  na: string,
  tekst = UZASADNIENIE,
  zdjecie: string | null = null,
) {
  return client.rpc("oddaj_glos", {
    p_kategoria: kategoria,
    p_nominowany: na,
    p_uzasadnienie: tekst,
    p_zdjecie: zdjecie,
  });
}

async function widok(client: SupabaseClient, id: string): Promise<Kategoria> {
  const { data, error } = await client.rpc("gossipy");
  if (error) throw error;
  return (data as Kategoria[]).find((k) => k.id === id)!;
}

async function wgraj(client: SupabaseClient, sciezka: string) {
  pliki.push(sciezka);
  return client.storage.from("gossip").upload(sciezka, ZDJECIE, { contentType: "image/jpeg" });
}

async function ujawnij(k: string) {
  await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
  await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "ujawniona" });
}

describe("kategorie", () => {
  it("uczestnik nie utworzy kategorii", async () => {
    const { error } = await alaClient.rpc("utworz_kategorie", { p_tytul: "x", p_opis: null });
    expect(error!.message).toMatch(/admin/i);
  });

  it("admin zakłada samą kategorię - otwartą, z powiadomieniem dla wszystkich", async () => {
    const k = await nowaKategoria();
    const w = await widok(alaClient, k);
    expect(w.status).toBe("otwarta");
    expect(w).not.toHaveProperty("nominowani");

    const { data } = await admin
      .from("powiadomienia")
      .select("kanal, adresat, tytul")
      .eq("ref_type", "gossip")
      .eq("ref_id", k);
    expect(data).toEqual([{ kanal: "push", adresat: "all", tytul: "Nowe gossipy" }]);
  });
});

describe("nominacja", () => {
  it("przyjęty nominuje raz dowolnego przyjętego, z uzasadnieniem, nie siebie", async () => {
    const k = await nowaKategoria();

    const siebie = await glos(alaClient, k, ala.id);
    expect(siebie.error!.message).toMatch(/siebie/);

    const krotkie = await glos(alaClient, k, ola.id, "Bo tak.");
    expect(krotkie.error!.message).toMatch(/200/);

    expect((await glos(alaClient, k, ola.id)).error).toBeNull();

    const drugi = await glos(alaClient, k, ela.id);
    expect(drugi.error!.message).toMatch(/juz oddana/i);

    const w = await widok(alaClient, k);
    expect(w.moj_glos).toBe(ola.id);
    expect(w.moj_typ).toBe("Ola");
  });

  it("nie da się nominować nieprzyjętego", async () => {
    const k = await nowaKategoria();
    const { error } = await glos(alaClient, k, czekajacy.id);
    expect(error!.message).toMatch(/przyjetego/);
  });

  it("czekający na akceptację i niezalogowany nie nominują", async () => {
    const k = await nowaKategoria();
    expect((await glos(czekajacyClient, k, ola.id)).error).not.toBeNull();
    expect((await glos(anonimowy(), k, ola.id)).error).not.toBeNull();
  });

  it("zamknięta kategoria nie przyjmuje nominacji", async () => {
    const k = await nowaKategoria();
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    const { error } = await glos(elaClient, k, ola.id);
    expect(error!.message).toMatch(/otwart/i);
  });

  it("lista kandydatów to przyjęci bez pytającego", async () => {
    const { data, error } = await alaClient.rpc("kandydaci_gossipow");
    expect(error).toBeNull();
    const id = (data as { id: string }[]).map((k) => k.id);
    expect(id).toContain(ola.id);
    expect(id).toContain(ela.id);
    expect(id).not.toContain(ala.id);
    expect(id).not.toContain(czekajacy.id);
  });

  it("nikt poza funkcjami nie czyta głosów - autor nie wychodzi do przeglądarki", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id);

    const { data, error } = await alaClient.from("gossip_votes").select("voter_id");
    // Brak grantu SELECT: błąd uprawnień, nie pusta lista - pusta lista byłaby
    // też wynikiem pustej tabeli i niczego by nie dowodziła.
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();

    await ujawnij(k);
    const w = await widok(alaClient, k);
    expect(JSON.stringify(w)).not.toContain(ela.id);
  });
});

describe("zdjęcie", () => {
  it("zdjęcie z nominacji widać dopiero po ujawnieniu i tylko o zwycięzcy", async () => {
    const k = await nowaKategoria();
    const oOli = `${k}/${crypto.randomUUID()}.jpg`;
    const oAli = `${k}/${crypto.randomUUID()}.jpg`;
    expect((await wgraj(elaClient, oOli)).error).toBeNull();
    expect((await wgraj(olaClient, oAli)).error).toBeNull();

    expect((await glos(elaClient, k, ola.id, UZASADNIENIE, oOli)).error).toBeNull();
    expect((await glos(alaClient, k, ola.id)).error).toBeNull();
    expect((await glos(olaClient, k, ala.id, UZASADNIENIE, oAli)).error).toBeNull();

    // Przed ujawnieniem nikt poza adminem nie pobierze pliku - nawet autor.
    expect((await alaClient.storage.from("gossip").download(oOli)).data).toBeNull();
    expect((await elaClient.storage.from("gossip").download(oOli)).data).toBeNull();
    expect((await szefClient.storage.from("gossip").download(oOli)).data).not.toBeNull();

    await ujawnij(k);

    const w = await widok(alaClient, k);
    expect(w.uzasadnienia!.map((u) => u.zdjecie)).toContain(oOli);
    expect((await alaClient.storage.from("gossip").download(oOli)).data).not.toBeNull();
    // Zdjęcie o przegranej zostaje zamknięte.
    expect((await alaClient.storage.from("gossip").download(oAli)).data).toBeNull();
  });

  it("ścieżka musi być losowa, w folderze kategorii i wgrana przez nominującego", async () => {
    const k = await nowaKategoria();

    const zId = `${k}/${ela.id}-cos.jpg`;
    await wgraj(elaClient, zId);
    expect((await glos(elaClient, k, ola.id, UZASADNIENIE, zId)).error!.message).toMatch(/zdjecie/i);

    const cudze = `${k}/${crypto.randomUUID()}.jpg`;
    await wgraj(olaClient, cudze);
    expect((await glos(elaClient, k, ola.id, UZASADNIENIE, cudze)).error!.message).toMatch(/zdjecie/i);

    const nieistniejace = `${k}/${crypto.randomUUID()}.jpg`;
    expect((await glos(elaClient, k, ola.id, UZASADNIENIE, nieistniejace)).error!.message).toMatch(/zdjecie/i);
  });

  it("do zamkniętej kategorii i poza folder kategorii nie da się wgrać", async () => {
    const k = await nowaKategoria();
    await szefClient.rpc("zmien_status_kategorii", { p_kategoria: k, p_status: "zamknieta" });
    expect((await wgraj(elaClient, `${k}/${crypto.randomUUID()}.jpg`)).error).not.toBeNull();
    expect((await wgraj(elaClient, `${ela.id}/${crypto.randomUUID()}.jpg`)).error).not.toBeNull();
    expect((await wgraj(czekajacyClient, `${k}/${crypto.randomUUID()}.jpg`)).error).not.toBeNull();
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
    await ujawnij(k);

    const w = await widok(elaClient, k);
    expect(w.zwyciezcy).toEqual([{ id: ola.id, nazwa: "Ola" }]);
    expect(w.uzasadnienia).toHaveLength(2);
    // Uzasadnienie o przegranej nie wychodzi - zdradzałoby, ile dostała nominacji.
    expect(w.uzasadnienia!.map((u) => u.tekst).join(" ")).not.toContain("Ola o Ali");
    expect(JSON.stringify(w)).not.toMatch(/"glosy"/);
  });

  it("remis daje kilku zwycięzców", async () => {
    const k = await nowaKategoria();
    await glos(elaClient, k, ola.id);
    await glos(olaClient, k, ala.id);
    await ujawnij(k);

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

    await ujawnij(k);

    const { data } = await admin
      .from("powiadomienia")
      .select("tytul, adresat, link")
      .eq("ref_type", "gossip")
      .eq("ref_id", k)
      .eq("tytul", "Wyniki gossipów");
    expect(data).toEqual([{ tytul: "Wyniki gossipów", adresat: "all", link: "/app/gossip" }]);
  });
});

describe("moderacja", () => {
  it("admin widzi autora i zdjęcie, ukrywa nominację - głos dalej się liczy", async () => {
    const k = await nowaKategoria();
    const sciezka = `${k}/${crypto.randomUUID()}.jpg`;
    await wgraj(elaClient, sciezka);
    await glos(elaClient, k, ola.id, UZASADNIENIE + " niestosowne", sciezka);

    const { data: m, error } = await szefClient.rpc("moderacja_gossipow", { p_kategoria: k });
    expect(error).toBeNull();
    const wpis = (m as { id: string; autor: string; zdjecie: string | null }[])[0];
    expect(wpis.autor).toBeTruthy();
    expect(wpis.zdjecie).toBe(sciezka);

    expect((await szefClient.rpc("ukryj_uzasadnienie", { p_glos: wpis.id, p_ukryte: true })).error).toBeNull();

    await ujawnij(k);
    const w = await widok(alaClient, k);
    expect(w.zwyciezcy).toEqual([{ id: ola.id, nazwa: "Ola" }]);
    expect(w.uzasadnienia).toEqual([]);
    // Ukryte zdjęcie znika razem z tekstem.
    expect((await alaClient.storage.from("gossip").download(sciezka)).data).toBeNull();
  });

  it("uczestnik nie zajrzy do moderacji", async () => {
    const k = await nowaKategoria();
    const { error } = await alaClient.rpc("moderacja_gossipow", { p_kategoria: k });
    expect(error!.message).toMatch(/admin/i);
  });
});
