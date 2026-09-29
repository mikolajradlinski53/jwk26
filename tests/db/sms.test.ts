import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();

type Paczka = { id: number; tytul: string; tresc: string | null; numery: string[] }[];

let zgoda: TestUser;
let bezZgody: TestUser;
let alaClient: SupabaseClient;
let szefClient: SupabaseClient;
let sekret: string;
const nonce = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const NUMER_ZGODA = `600${nonce}`;
const NUMER_BEZ = `700${nonce}`;
const moje: number[] = [];

beforeAll(async () => {
  zgoda = await nowyUzytkownik("sms-zgoda");
  bezZgody = await nowyUzytkownik("sms-bez");
  const szef = await nowyAdmin("sms-szef");
  await ustawJakoZaakceptowany(zgoda);
  await ustawJakoZaakceptowany(bezZgody);
  await admin.from("profiles").update({ phone: NUMER_ZGODA, sms_consent: true }).eq("id", zgoda.id);
  await admin.from("profiles").update({ phone: NUMER_BEZ, sms_consent: false }).eq("id", bezZgody.id);

  const { data: s } = await admin.from("sekrety").select("wartosc").eq("klucz", "sms").single();
  sekret = s!.wartosc as string;

  alaClient = await signIn(zgoda);
  szefClient = await signIn(szef);
});

afterEach(async () => {
  if (moje.length) await admin.from("powiadomienia").delete().in("id", moje.splice(0));
});

afterAll(posprzataj);

async function ogloszenie(sms?: boolean): Promise<number> {
  const { data, error } = await szefClient.rpc("wyslij_ogloszenie", {
    p_tytul: "Zbiórka",
    p_tresc: "O 10:00 przy autokarze",
    p_adresat: "all",
    ...(sms === undefined ? {} : { p_sms: sms }),
  });
  if (error) throw error;
  const { data: wiersze } = await admin
    .from("powiadomienia")
    .select("id")
    .or(`id.eq.${data},ref_id.eq.${data}`);
  moje.push(...(wiersze ?? []).map((w) => w.id as number));
  return data as number;
}

async function paczka(): Promise<Paczka> {
  const { data, error } = await anonimowy().rpc("pobierz_sms", { p_sekret: sekret });
  if (error) throw error;
  return (data as Paczka).filter((p) => moje.includes(p.id));
}

describe("ogłoszenie z SMS-em", () => {
  it("domyślnie tylko push; z p_sms także wiersz SMS", async () => {
    const bez = await ogloszenie();
    const { data: a } = await admin.from("powiadomienia").select("kanal").or(`id.eq.${bez},ref_id.eq.${bez}`);
    expect(a!.map((w) => w.kanal)).toEqual(["push"]);

    const z = await ogloszenie(true);
    const { data: b } = await admin.from("powiadomienia").select("kanal").or(`id.eq.${z},ref_id.eq.${z}`);
    expect(b!.map((w) => w.kanal).sort()).toEqual(["push", "sms"]);
  });
});

describe("wysyłka SMS", () => {
  it("zły sekret i zalogowany uczestnik są odbici", async () => {
    expect((await anonimowy().rpc("pobierz_sms", { p_sekret: "zgadywanka" })).error!.message).toMatch(/dostepu/);
    expect((await alaClient.rpc("pobierz_sms", { p_sekret: sekret })).error).not.toBeNull();
    // Sekret pusha nie otwiera SMS-ów.
    const { data: push } = await admin.from("sekrety").select("wartosc").eq("klucz", "push").single();
    expect((await anonimowy().rpc("pobierz_sms", { p_sekret: push!.wartosc })).error).not.toBeNull();
  });

  it("paczka niesie numery wyłącznie osób ze zgodą", async () => {
    await ogloszenie(true);
    const [p] = await paczka();
    expect(p.tytul).toBe("Zbiórka");
    expect(p.numery).toContain(NUMER_ZGODA);
    expect(p.numery).not.toContain(NUMER_BEZ);
  });

  it("oznaczony SMS nie wraca; przeterminowany (starszy niż godzina) też nie", async () => {
    await ogloszenie(true);
    const [p] = await paczka();
    const { error } = await anonimowy().rpc("oznacz_sms", { p_sekret: sekret, p_id: p.id, p_wyslane: 1 });
    expect(error).toBeNull();
    expect(await paczka()).toEqual([]);

    await ogloszenie(true);
    const stary = moje.at(-1)!;
    await admin
      .from("powiadomienia")
      .update({ created_at: new Date(Date.now() - 2 * 3600_000).toISOString() })
      .eq("kanal", "sms")
      .in("id", moje);
    expect((await paczka()).map((x) => x.id)).not.toContain(stary);
  });

  it("wycofanie zgody zdejmuje numer z kolejnych wysyłek", async () => {
    await alaClient.rpc("wycofaj_zgode_sms");
    await ogloszenie(true);
    const [p] = await paczka();
    expect(p.numery).not.toContain(NUMER_ZGODA);
    await admin.from("profiles").update({ sms_consent: true }).eq("id", zgoda.id);
  });
});
