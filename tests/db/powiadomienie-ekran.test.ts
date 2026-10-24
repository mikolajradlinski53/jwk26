import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, signIn, createUser, deleteUser, idDruzyn, ustawJakoZaakceptowany, type TestUser } from "../helpers/supabase";

// Ekran powiadomienia (2026-10-24): kliknięcie w push otwiera /app/powiadomienie/<id>.
// Treść czyta tylko adresat (ten sam podział co przy wysyłce).
let A: string, B: string;
let zA: TestUser, zB: TestUser;
let klientA: SupabaseClient, klientB: SupabaseClient;

beforeAll(async () => {
  [A, B] = await idDruzyn();
  [zA, zB] = await Promise.all([createUser("powiad-a"), createUser("powiad-b")]);
  await Promise.all([ustawJakoZaakceptowany(zA, A), ustawJakoZaakceptowany(zB, B)]);
  [klientA, klientB] = await Promise.all([signIn(zA), signIn(zB)]);
});

afterEach(async () => {
  await admin.from("powiadomienia").delete().eq("ref_type", "test-ekran");
});

afterAll(async () => {
  await Promise.all([zA, zB].map(deleteUser));
});

async function wstaw(adresat: string, adresatId: string | null) {
  const { data, error } = await admin
    .from("powiadomienia")
    .insert({ kanal: "in_app", adresat, adresat_id: adresatId, tytul: "Macie kapitana", body: "Kapitanem jest Ala", link: "/app", ref_type: "test-ekran" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

describe("ekran powiadomienia", () => {
  it("adresat drużynowego powiadomienia widzi treść", async () => {
    const id = await wstaw("team", A);
    const { data, error } = await klientA.rpc("moje_powiadomienie", { p_id: id });
    expect(error).toBeNull();
    expect(data).toMatchObject([{ id, tytul: "Macie kapitana", body: "Kapitanem jest Ala", link: "/app" }]);
  });

  it("osoba spoza adresatów nie dostaje nic", async () => {
    const id = await wstaw("team", A);
    const { data } = await klientB.rpc("moje_powiadomienie", { p_id: id });
    expect(data).toEqual([]);
  });

  it("powiadomienie do wszystkich widzi każdy przyjęty", async () => {
    const id = await wstaw("all", null);
    const { data } = await klientB.rpc("moje_powiadomienie", { p_id: id });
    expect(data).toHaveLength(1);
  });
});
