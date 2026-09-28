import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  idZadania,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

type Paczka = {
  id: number;
  tytul: string;
  tresc: string | null;
  link: string;
  subskrypcje: { endpoint: string; p256dh: string; auth: string }[];
}[];

// Ala i Ola w drużynie A (Ala w puli Świeżaków), Obcy w drużynie B, Czekający
// jeszcze nieprzyjęty. Każdy ma jedną subskrypcję z unikalnym adresem.
let ala: TestUser;
let ola: TestUser;
let obcy: TestUser;
let czekajacy: TestUser;
let szef: TestUser;
let alaClient: SupabaseClient;
let olaClient: SupabaseClient;
let szefClient: SupabaseClient;
let czekajacyClient: SupabaseClient;
let druzynaA: string;
let druzynaB: string;
let sekret: string;
const nonce = Math.random().toString(36).slice(2, 10);
const adres = (kto: string) => `https://push.example/${nonce}/${kto}`;
const nowePowiadomienia: number[] = [];

beforeAll(async () => {
  [druzynaA, druzynaB] = await idDruzyn();
  [ala, ola, obcy, czekajacy, szef] = await Promise.all([
    createUser("ala-push"),
    createUser("ola-push"),
    createUser("obcy-push"),
    createUser("czekajacy-push"),
    createUser("szef-push"),
  ]);
  await makeAdmin(szef);
  await ustawJakoZaakceptowany(ala, druzynaA);
  await ustawJakoZaakceptowany(ola, druzynaA);
  await ustawJakoZaakceptowany(obcy, druzynaB);

  const { error } = await admin.from("registrations").insert({
    user_id: ala.id,
    full_name: "Ala",
    proof_path: `${ala.id}/d.jpg`,
    status: "approved",
    pula: "swiezaki",
  });
  if (error) throw error;

  const { data: s } = await admin.from("sekrety").select("wartosc").eq("klucz", "push").single();
  sekret = s!.wartosc as string;

  alaClient = await signIn(ala);
  olaClient = await signIn(ola);
  szefClient = await signIn(szef);
  czekajacyClient = await signIn(czekajacy);

  for (const [client, kto] of [
    [alaClient, "ala"],
    [olaClient, "ola"],
    [await signIn(obcy), "obcy"],
    [czekajacyClient, "czekajacy"],
  ] as const) {
    const { error: e } = await client.rpc("zapisz_subskrypcje", {
      p_endpoint: adres(kto),
      p_p256dh: "klucz-" + kto,
      p_auth: "auth-" + kto,
    });
    if (e) throw e;
  }
});

afterEach(async () => {
  if (nowePowiadomienia.length) {
    await admin.from("powiadomienia").delete().in("id", nowePowiadomienia.splice(0));
  }
});

afterAll(async () => {
  await admin.from("push_subscriptions").delete().like("endpoint", `https://push.example/${nonce}/%`);
  await admin.from("bingo_submissions").delete().in("user_id", [ala.id]);
  await admin.from("registrations").delete().in("user_id", [ala.id, czekajacy.id]);
  await Promise.all([ala, ola, obcy, czekajacy, szef].map(deleteUser));
});

/** Paczka do wysłania, zawężona do powiadomień z tego pliku. */
async function paczka(): Promise<Paczka> {
  const { data, error } = await anonimowy().rpc("pobierz_push", { p_sekret: sekret });
  if (error) throw error;
  return (data as Paczka).filter((p) => nowePowiadomienia.includes(p.id));
}

/** Nasze adresy subskrypcji w powiadomieniu, posortowane. */
function naszeAdresy(p: Paczka[number]): string[] {
  return p.subskrypcje
    .map((s) => s.endpoint)
    .filter((e) => e.startsWith(`https://push.example/${nonce}/`))
    .map((e) => e.split("/").at(-1)!)
    .sort();
}

async function ogloszenie(opcje: Record<string, unknown>) {
  const { data, error } = await szefClient.rpc("wyslij_ogloszenie", {
    p_tytul: "Zbiórka",
    p_tresc: "O 10:00 przy autokarze",
    ...opcje,
  });
  if (error) throw error;
  nowePowiadomienia.push(data as number);
  return data as number;
}

describe("subskrypcje", () => {
  it("każdy widzi wyłącznie własne subskrypcje", async () => {
    const { data } = await alaClient.from("push_subscriptions").select("endpoint");
    expect(data).toEqual([{ endpoint: adres("ala") }]);
  });

  it("uczestnik nie dopisze subskrypcji zwykłym INSERT-em", async () => {
    const { error } = await alaClient
      .from("push_subscriptions")
      .insert({ user_id: ola.id, endpoint: adres("podrobka"), p256dh: "x", auth: "y" });
    expect(error).not.toBeNull();
  });

  it("adres spoza https jest odbity", async () => {
    const { error } = await alaClient.rpc("zapisz_subskrypcje", {
      p_endpoint: "http://zlo.example/x",
      p_p256dh: "x",
      p_auth: "y",
    });
    expect(error).not.toBeNull();
  });

  it("usunięcie dotyczy tylko własnej subskrypcji", async () => {
    await alaClient.rpc("usun_subskrypcje", { p_endpoint: adres("ola") });
    const { data } = await admin.from("push_subscriptions").select("id").eq("endpoint", adres("ola"));
    expect(data).toHaveLength(1);
  });
});

describe("ogłoszenia i adresaci", () => {
  it("uczestnik nie wyśle ogłoszenia", async () => {
    const { error } = await alaClient.rpc("wyslij_ogloszenie", {
      p_tytul: "x",
      p_tresc: "y",
      p_adresat: "all",
    });
    expect(error!.message).toMatch(/admin/i);
  });

  it("„wszyscy” to przyjęci — bez osób czekających na akceptację", async () => {
    await ogloszenie({ p_adresat: "all" });
    const [p] = await paczka();
    expect(naszeAdresy(p)).toEqual(["ala", "obcy", "ola"]);
    expect(p).toMatchObject({ tytul: "Zbiórka", tresc: "O 10:00 przy autokarze", link: "/app" });
  });

  it("drużyna trafia tylko do swoich, pula tylko do przyjętych w puli", async () => {
    await ogloszenie({ p_adresat: "team", p_druzyna: druzynaA });
    await ogloszenie({ p_adresat: "pula", p_pula: "swiezaki" });
    const [druzyna, pula] = await paczka();
    expect(naszeAdresy(druzyna)).toEqual(["ala", "ola"]);
    expect(naszeAdresy(pula)).toEqual(["ala"]);
  });

  it("ogłoszenie do drużyny bez drużyny jest odbite", async () => {
    const { error } = await szefClient.rpc("wyslij_ogloszenie", {
      p_tytul: "x",
      p_tresc: "y",
      p_adresat: "team",
    });
    expect(error).not.toBeNull();
  });
});

describe("wysyłka", () => {
  it("zły sekret jest odbity, zalogowany uczestnik też", async () => {
    const zly = await anonimowy().rpc("pobierz_push", { p_sekret: "zgadywanka" });
    expect(zly.error!.message).toMatch(/dostepu/);
    const zalogowany = await alaClient.rpc("pobierz_push", { p_sekret: sekret });
    expect(zalogowany.error).not.toBeNull();
  });

  it("oznaczenie wysłania zapisuje liczbę i kasuje martwe subskrypcje", async () => {
    const id = await ogloszenie({ p_adresat: "all" });
    const { error } = await anonimowy().rpc("oznacz_push", {
      p_sekret: sekret,
      p_id: id,
      p_wyslane: 2,
      p_martwe: [adres("obcy")],
    });
    expect(error).toBeNull();

    const { data: w } = await admin
      .from("powiadomienia")
      .select("wyslane_at, wyslane_do")
      .eq("id", id)
      .single();
    expect(w!.wyslane_at).not.toBeNull();
    expect(w!.wyslane_do).toBe(2);

    // Wysłane nie wraca w kolejnej paczce, a martwy adres zniknął.
    expect(await paczka()).toEqual([]);
    const { data: s } = await admin.from("push_subscriptions").select("id").eq("endpoint", adres("obcy"));
    expect(s).toEqual([]);
  });

  it("po pięciu nieudanych próbach powiadomienie przestaje wracać", async () => {
    // Martwe powiadomienie nie może krążyć bez końca — ponawia je pg_cron co minutę.
    await ogloszenie({ p_adresat: "all" });
    for (let i = 0; i < 5; i++) expect(await paczka()).toHaveLength(1);
    expect(await paczka()).toEqual([]);
  });
});

describe("automaty", () => {
  it("przyjęcie zgłoszenia powiadamia przyjętą osobę", async () => {
    const { data: z, error } = await admin
      .from("registrations")
      .insert({ user_id: czekajacy.id, full_name: "C", proof_path: `${czekajacy.id}/d.jpg` })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("registrations").update({ status: "approved" }).eq("id", z!.id);

    const { data: w } = await admin
      .from("powiadomienia")
      .select("id, kanal, adresat, adresat_id, link")
      .eq("ref_type", "registration")
      .eq("ref_id", z!.id)
      .single();
    nowePowiadomienia.push(w!.id as number);
    expect(w).toMatchObject({ kanal: "push", adresat: "user", adresat_id: czekajacy.id, link: "/app" });
  });

  it("zaliczone pole bingo powiadamia drużynę", async () => {
    const { data: b, error } = await admin
      .from("bingo_submissions")
      .insert({ team_id: druzynaA, user_id: ala.id, task_id: await idZadania(24), photo_path: `${ala.id}/b.jpg` })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("bingo_submissions").update({ status: "approved" }).eq("id", b!.id);

    const { data: w } = await admin
      .from("powiadomienia")
      .select("id, adresat, adresat_id, tytul, body, link")
      .eq("ref_type", "bingo")
      .eq("ref_id", b!.id)
      .single();
    nowePowiadomienia.push(w!.id as number);
    expect(w).toMatchObject({ adresat: "team", adresat_id: druzynaA, link: "/app/bingo" });
    expect(w!.body).toMatch(/pkt/);
  });
});
