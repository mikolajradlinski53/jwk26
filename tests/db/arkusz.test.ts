import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  createUser,
  deleteUser,
  idDruzyn,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

type Tabela = { naglowki: string[]; wiersze: (string | number | null)[][] };
type Eksport = {
  podsumowanie: Tabela;
  zapisy: Tabela;
  wrazliwe: Tabela;
  wygenerowano: string;
};

// Przyjęta osoba z danymi wrażliwymi i osoba na rezerwie. Skrypt arkusza woła
// funkcję kluczem anon z sekretem - tak samo robią to testy.
let przyjety: TestUser;
let rezerwowa: TestUser;
let przyjetyClient: SupabaseClient;
let sekret: string;

beforeAll(async () => {
  const [druzyna] = await idDruzyn();
  [przyjety, rezerwowa] = await Promise.all([
    createUser("przyjety-arkusz"),
    createUser("rezerwowa-arkusz"),
  ]);
  await ustawJakoZaakceptowany(przyjety, druzyna);

  const wspolne = {
    full_name: "x",
    pula: "swiezaki",
    dojazd: "wlasny",
    alkohol: null,
    zwolnienie_od: null,
    zwolnienie_do: null,
  };
  const { data, error } = await admin
    .from("registrations")
    .insert([
      {
        ...wspolne,
        user_id: przyjety.id,
        status: "approved",
        imie: "Jan",
        nazwisko: "Arkuszowy",
        proof_path: `${przyjety.id}/dowod.jpg`,
        rezerwa: false,
        kolejnosc_rezerwy: null,
        // Wartość, którą Sheets wykonałby jako formułę - skrypt ją rozbraja,
        // ale baza ma ją oddać bez zmian.
        uwagi: "=HYPERLINK(\"http://zlo\")",
      },
      {
        ...wspolne,
        user_id: rezerwowa.id,
        status: "pending",
        imie: "Ala",
        nazwisko: "Rezerwowa",
        proof_path: null,
        rezerwa: true,
        kolejnosc_rezerwy: 1,
        uwagi: null,
      },
    ])
    .select("id, user_id");
  if (error) throw error;

  const id = data!.find((r) => r.user_id === przyjety.id)!.id;
  const { error: bladW } = await admin.from("dane_wrazliwe").insert({
    registration_id: id,
    ice_imie: "Anna",
    ice_relacja: "mama",
    ice_telefon: "600200300",
    ice_poinformowany: true,
    alergie: "orzechy",
    zgoda_art9_at: new Date().toISOString(),
  });
  if (bladW) throw bladW;

  const { data: s, error: bladS } = await admin
    .from("sekrety")
    .select("wartosc")
    .eq("klucz", "arkusz")
    .single();
  if (bladS) throw bladS;
  sekret = s.wartosc as string;

  przyjetyClient = await signIn(przyjety);
});

afterAll(async () => {
  await admin.from("registrations").delete().in("user_id", [przyjety.id, rezerwowa.id]);
  await Promise.all([przyjety, rezerwowa].map(deleteUser));
});

function kolumna(t: Tabela, wiersz: (string | number | null)[], nazwa: string) {
  return wiersz[t.naglowki.indexOf(nazwa)];
}

describe("eksport do arkusza", () => {
  it("zły sekret jest odbity", async () => {
    const { error } = await anonimowy().rpc("eksport_arkusza", { p_sekret: "zgadywanka" });
    expect(error!.message).toMatch(/dostepu/);
  });

  it("zalogowany uczestnik nie wywoła eksportu nawet z sekretem", async () => {
    // Funkcja jest dla skryptu (rola anon z sekretem) - nie dla sesji w apce.
    const { error } = await przyjetyClient.rpc("eksport_arkusza", { p_sekret: sekret });
    expect(error).not.toBeNull();
  });

  it("zwraca zapisy z polskimi etykietami i dane wrażliwe osobno", async () => {
    const { data, error } = await anonimowy().rpc("eksport_arkusza", { p_sekret: sekret });
    expect(error).toBeNull();
    const e = data as Eksport;

    const jan = e.zapisy.wiersze.find((w) => kolumna(e.zapisy, w, "Nazwisko") === "Arkuszowy")!;
    expect(kolumna(e.zapisy, jan, "Status")).toBe("Przyjęte");
    expect(kolumna(e.zapisy, jan, "Pula")).toBe("Świeżaki");
    expect(kolumna(e.zapisy, jan, "Dojazd")).toBe("Dojeżdżam samodzielnie w obie strony");
    expect(kolumna(e.zapisy, jan, "Drużyna")).toBeTruthy();
    expect(kolumna(e.zapisy, jan, "E-mail")).toBe(przyjety.email);
    expect(kolumna(e.zapisy, jan, "Uwagi")).toBe('=HYPERLINK("http://zlo")');
    // Dane o zdrowiu nie mieszkają w zakładce „Zapisy".
    expect(e.zapisy.naglowki).not.toContain("Alergie");

    const ala = e.zapisy.wiersze.find((w) => kolumna(e.zapisy, w, "Nazwisko") === "Rezerwowa")!;
    expect(kolumna(e.zapisy, ala, "Status")).toBe("Rezerwa (1.)");
    expect(kolumna(e.zapisy, ala, "Przelew")).toBe("nie");

    const wJan = e.wrazliwe.wiersze.find((w) => kolumna(e.wrazliwe, w, "Nazwisko") === "Arkuszowy")!;
    expect(kolumna(e.wrazliwe, wJan, "Alergie")).toBe("orzechy");
    expect(kolumna(e.wrazliwe, wJan, "ICE")).toBe("Anna (mama), 600200300");
    // Osoba bez danych wrażliwych nie ma pustego wiersza w tej zakładce.
    expect(
      e.wrazliwe.wiersze.some((w) => kolumna(e.wrazliwe, w, "Nazwisko") === "Rezerwowa"),
    ).toBe(false);

    expect(e.podsumowanie.wiersze.map((w) => w[0])).toEqual(["Działacze", "Świeżaki", "Alumni"]);
    expect(e.wygenerowano).toBeTruthy();
  });
});
