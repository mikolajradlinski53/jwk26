import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  firstTeamId,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

type Kolejki = { sklepik: number; bingo: number; zgloszenia: number; gossipy: number };

const UZASADNIENIE =
  "Bo na każdej imprezie to właśnie ta osoba pierwsza wchodzi na parkiet, ostatnia z niego schodzi, " +
  "a w międzyczasie zdąży jeszcze zorganizować konkurs karaoke, pogodzić dwie kłócące się drużyny " +
  "i przekonać ochronę ośrodka, że muzyka wcale nie jest za głośno.";

let ala: TestUser;
let ola: TestUser;
let szef: TestUser;
let alaClient: SupabaseClient;
let szefClient: SupabaseClient;
const kategorie: string[] = [];

beforeAll(async () => {
  const druzyna = await firstTeamId();
  [ala, ola, szef] = await Promise.all([
    createUser("ala-porz"),
    createUser("ola-porz"),
    createUser("szef-porz"),
  ]);
  await makeAdmin(szef);
  for (const u of [ala, ola]) await ustawJakoZaakceptowany(u, druzyna);
  alaClient = await signIn(ala);
  szefClient = await signIn(szef);
});

afterEach(async () => {
  if (kategorie.length) await admin.from("gossip_categories").delete().in("id", kategorie.splice(0));
});

afterAll(async () => {
  await Promise.all([ala, ola, szef].map(deleteUser));
});

async function kolejki(c: SupabaseClient): Promise<Kolejki> {
  const { data, error } = await c.rpc("admin_kolejki");
  if (error) throw error;
  return data as Kolejki;
}

async function licz(tabela: string, status: string): Promise<number> {
  const { count } = await admin.from(tabela).select("id", { count: "exact", head: true }).eq("status", status);
  return count ?? 0;
}

/** Kategoria z jednym głosem Ali — zwraca id głosu. */
async function glosDoModeracji(): Promise<string> {
  const { data: kat, error } = await szefClient.rpc("utworz_kategorie", {
    p_tytul: "Król parkietu",
    p_opis: null,
    p_nominowani: [ala.id, ola.id],
  });
  if (error) throw error;
  kategorie.push(kat as string);
  const { error: e2 } = await alaClient.rpc("oddaj_glos", {
    p_kategoria: kat,
    p_nominowany: ola.id,
    p_uzasadnienie: UZASADNIENIE,
  });
  if (e2) throw e2;
  const { data } = await admin.from("gossip_votes").select("id").eq("category_id", kat).single();
  return data!.id as string;
}

describe("admin_kolejki", () => {
  it("liczby zgadzają się ze stanem tabel", async () => {
    const k = await kolejki(szefClient);
    expect(k.sklepik).toBe(await licz("shop_orders", "pending"));
    expect(k.bingo).toBe(await licz("bingo_submissions", "pending"));
    expect(k.zgloszenia).toBe(await licz("registrations", "pending"));
  });

  it("uczestnik dostaje odmowę", async () => {
    const { error } = await alaClient.rpc("admin_kolejki");
    expect(error!.message).toMatch(/admin/i);
  });

  it("nowe uzasadnienie zapala gossipy, przejrzane i ukryte gaszą", async () => {
    const przed = (await kolejki(szefClient)).gossipy;
    const glos = await glosDoModeracji();
    expect((await kolejki(szefClient)).gossipy).toBe(przed + 1);

    expect((await szefClient.rpc("oznacz_przejrzane", { p_glos: glos })).error).toBeNull();
    expect((await kolejki(szefClient)).gossipy).toBe(przed);

    // Ukrycie też oznacza jako przejrzane.
    await admin.from("gossip_votes").update({ przejrzane_at: null }).eq("id", glos);
    expect((await szefClient.rpc("ukryj_uzasadnienie", { p_glos: glos, p_ukryte: true })).error).toBeNull();
    const { data } = await admin.from("gossip_votes").select("przejrzane_at").eq("id", glos).single();
    expect(data!.przejrzane_at).not.toBeNull();
    expect((await kolejki(szefClient)).gossipy).toBe(przed);
  });

  it("uczestnik nie oznaczy przejrzanego", async () => {
    const glos = await glosDoModeracji();
    const { error } = await alaClient.rpc("oznacz_przejrzane", { p_glos: glos });
    expect(error!.message).toMatch(/admin/i);
  });

  it("moderacja zwraca flagę przejrzane", async () => {
    const glos = await glosDoModeracji();
    const { data: kat } = await admin.from("gossip_votes").select("category_id").eq("id", glos).single();
    const { data } = await szefClient.rpc("moderacja_gossipow", { p_kategoria: kat!.category_id });
    expect((data as { id: string; przejrzane: boolean }[])[0].przejrzane).toBe(false);
  });
});
