import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  sprzatanieUzytkownikow,
  zgloszenieDla,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Jeden zwykły uczestnik i jeden admin na cały plik, założeni raz w beforeAll.
// Od planu 08 zgłoszenie powstaje wyłącznie przez zloz_zgloszenie(), więc
// wiersze do testów odczytu, zmiany i kasowania wstawiamy kluczem serwisowym.
// Samą funkcję bada tests/db/zapisy.test.ts.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let adminUser: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  uczestnik = await createUser("uczestnik-rejestracje");
  uczestnikClient = await signIn(uczestnik);
  adminUser = await createUser("kaplan-rejestracje");
  await makeAdmin(adminUser);
  adminClient = await signIn(adminUser);
});

afterAll(async () => {
  await deleteUser(uczestnik);
  await deleteUser(adminUser);
});

afterEach(async () => {
  await admin.from("registrations").delete().in("user_id", [uczestnik.id, adminUser.id]);
  await posprzataj();
});

/** Wstawia zgłoszenie kluczem serwisowym i zwraca jego id. */
async function wstaw(user: TestUser): Promise<string> {
  const { data, error } = await admin
    .from("registrations")
    .insert(zgloszenieDla(user))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("zgłoszenia rejestracyjne", () => {
  it("nie pozwala złożyć zgłoszenia bezpośrednim INSERT-em", async () => {
    // Jedyne wejście to zloz_zgloszenie() (D5 speca zapisów): tylko ona
    // pilnuje limitu puli pod blokadą. INSERT z konsoli ominąłby naraz limit,
    // wiek i zgody.
    const { error } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));
    expect(error).not.toBeNull();

    const { data } = await admin.from("registrations").select("id").eq("user_id", uczestnik.id);
    expect(data ?? []).toEqual([]);
  });

  it("nie pokazuje cudzych zgłoszeń", async () => {
    const obcy = await nowyUzytkownik("skryty");
    await wstaw(obcy);

    const { data, error } = await uczestnikClient
      .from("registrations")
      .select("id")
      .eq("user_id", obcy.id);

    // RLS przy odczycie nie zwraca błędu, tylko pusty zbiór.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("pokazuje adminowi wszystkie zgłoszenia", async () => {
    const zglaszajacy = await nowyUzytkownik("petent");
    await wstaw(zglaszajacy);

    const { data } = await adminClient
      .from("registrations")
      .select("id")
      .eq("user_id", zglaszajacy.id);

    expect(data).toHaveLength(1);
  });

  it("pokazuje uczestnikowi jego własne zgłoszenie", async () => {
    await wstaw(uczestnik);

    // Na tym odczycie stoi cały ekran /rejestracja: poczekalnia, rezerwa,
    // prośba o przelew albo notatka o odrzuceniu.
    const { data } = await uczestnikClient.from("registrations").select("id, status");
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("pending");
  });

  it("nie pozwala uczestnikowi zmienić statusu zwykłym UPDATE-em", async () => {
    const id = await wstaw(uczestnik);

    const { data: poZmianie } = await uczestnikClient
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", id)
      .select();
    expect(poZmianie).toEqual([]);

    const { data: kontrola } = await admin.from("registrations").select("status").eq("id", id).single();
    expect(kontrola!.status).toBe("pending");
  });

  it("nie pozwala nawet adminowi zmienić statusu zwykłym UPDATE-em", async () => {
    const petent = await nowyUzytkownik("podopieczny");
    const id = await wstaw(petent);

    // Kontrola: admin ten wiersz widzi, więc puste [] niżej znaczy „nie wolno",
    // a nie „nie widzę".
    const { data: widoczny } = await adminClient.from("registrations").select("id").eq("id", id);
    expect(widoczny).toHaveLength(1);

    // Ktoś odruchowo „naprawi" to, dokładając registrations_admin_write na wzór
    // teams_admin_write - i zniknie gwarancja, że status zmienia się wyłącznie
    // przez review_registration.
    const { data: poZmianie } = await adminClient
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", id)
      .select();
    expect(poZmianie).toEqual([]);

    const { data: kontrola } = await admin.from("registrations").select("status").eq("id", id).single();
    expect(kontrola!.status).toBe("pending");
  });

  it("nie pozwala skasować zgłoszenia", async () => {
    const id = await wstaw(uczestnik);

    const { data: poKasowaniu } = await uczestnikClient
      .from("registrations")
      .delete()
      .eq("id", id)
      .select();
    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin.from("registrations").select("id").eq("id", id);
    expect(kontrola).toHaveLength(1);
  });
});

// Ograniczenia `check` z migracji hartowania dalej stoją na tabeli. Klucz
// serwisowy omija RLS, ale nie `check` - dlatego sprawdzamy je nim.
describe("ograniczenia pól OCR", () => {
  it("odrzuca pewność OCR spoza zakresu 0-1", async () => {
    const { error } = await admin
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), ocr_confidence: 5 });
    expect(error).not.toBeNull();
  });

  it("odrzuca liczbę trafionych słów spoza zakresu 0-6", async () => {
    const { error } = await admin
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), ocr_keywords_hit: 99 });
    expect(error).not.toBeNull();
  });

  it("odrzuca nadmiarowo długi tekst OCR", async () => {
    const { error } = await admin
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), ocr_text: "a".repeat(20_001) });
    expect(error).not.toBeNull();
  });
});
