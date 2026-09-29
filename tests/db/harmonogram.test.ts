import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();

let przyjety: SupabaseClient;
let czekajacy: SupabaseClient;
let szef: SupabaseClient;
const TYTUL = "Zbiórka pod rektoratem (test)";

beforeAll(async () => {
  const [a, b, c] = await Promise.all([
    nowyUzytkownik("harm-przyjety"),
    nowyUzytkownik("harm-czekajacy"),
    nowyAdmin("harm-szef"),
  ]);
  await ustawJakoZaakceptowany(a);
  [przyjety, czekajacy, szef] = await Promise.all([signIn(a), signIn(b), signIn(c)]);
});

afterEach(async () => {
  await admin.from("harmonogram").delete().like("tytul", "%(test)");
});

afterAll(posprzataj);

async function dodaj(client: SupabaseClient, tytul = TYTUL) {
  return client
    .from("harmonogram")
    .insert({ dzien: "2026-10-23", godzina: "08:00", tytul, opis: "Autokar odjeżdża punktualnie." })
    .select("id")
    .single();
}

describe("harmonogram", () => {
  it("admin dodaje, zmienia i usuwa punkt", async () => {
    const { data, error } = await dodaj(szef);
    expect(error).toBeNull();

    const zmiana = await szef.from("harmonogram").update({ godzina: "08:30" }).eq("id", data!.id).select("godzina");
    expect(zmiana.data).toEqual([{ godzina: "08:30:00" }]);

    await szef.from("harmonogram").delete().eq("id", data!.id);
    const { count } = await admin.from("harmonogram").select("id", { count: "exact", head: true }).eq("id", data!.id);
    expect(count).toBe(0);
  });

  it("przyjęty czyta, ale nie pisze", async () => {
    const { data } = await dodaj(szef);

    const odczyt = await przyjety.from("harmonogram").select("tytul").eq("id", data!.id);
    expect(odczyt.data).toEqual([{ tytul: TYTUL }]);

    expect((await dodaj(przyjety, "Samowolka (test)")).error).not.toBeNull();

    await przyjety.from("harmonogram").update({ tytul: "Zmienione (test)" }).eq("id", data!.id);
    await przyjety.from("harmonogram").delete().eq("id", data!.id);
    const { data: poProbie } = await admin.from("harmonogram").select("tytul").eq("id", data!.id).single();
    expect(poProbie!.tytul).toBe(TYTUL);
  });

  it("czekający na akceptację i niezalogowany nie widzą programu", async () => {
    await dodaj(szef);
    expect((await czekajacy.from("harmonogram").select("id")).data).toEqual([]);
    expect((await anonimowy().from("harmonogram").select("id")).error).not.toBeNull();
  });

  it("tytuł jest wymagany", async () => {
    const { error } = await szef.from("harmonogram").insert({ dzien: "2026-10-23", tytul: "   " });
    expect(error).not.toBeNull();
  });
});
