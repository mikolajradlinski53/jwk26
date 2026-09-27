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
  daneZapisu,
  ustawPule,
  ustawUstawienie,
  type TestUser,
} from "../helpers/supabase";

// Trzech uczestników i admin, logowani raz na plik — projekt testowy dopuszcza
// 30 logowań na pięć minut. Trzech, nie jeden: unikalny indeks pozwala osobie
// mieć tylko jedno zgłoszenie w toku, a test równoczesności i kolejka rezerwy
// potrzebują kilku osób naraz.
let ala: TestUser;
let ola: TestUser;
let obcy: TestUser;
let szef: TestUser;
let alaClient: SupabaseClient;
let olaClient: SupabaseClient;
let obcyClient: SupabaseClient;
let szefClient: SupabaseClient;

beforeAll(async () => {
  [ala, ola, obcy, szef] = await Promise.all([
    createUser("ala-zapisy"),
    createUser("ola-zapisy"),
    createUser("obcy-zapisy"),
    createUser("szef-zapisy"),
  ]);
  await makeAdmin(szef);
  alaClient = await signIn(ala);
  olaClient = await signIn(ola);
  obcyClient = await signIn(obcy);
  szefClient = await signIn(szef);
});

afterEach(async () => {
  const wszyscy = [ala.id, ola.id, obcy.id, szef.id];
  // dane_wrazliwe znikają kaskadą razem ze zgłoszeniem.
  await admin.from("registrations").delete().in("user_id", wszyscy);
  await admin
    .from("profiles")
    .update({ status: "pending", team_id: null, display_name: null, phone: null })
    .in("id", wszyscy.slice(0, 3));
});

afterAll(async () => {
  // Pule i flaga regulaminu są wspólne dla całego projektu testowego.
  // Zostawione otwarte zmieniłyby wynik następnego przebiegu.
  for (const k of ["dzialacze", "swiezaki", "alumni"]) await ustawPule(k, false, 0);
  await ustawUstawienie("regulamin_zatwierdzony", false);
  await Promise.all([ala, ola, obcy, szef].map(deleteUser));
});

describe("schemat zapisów", () => {
  it("trzy pule istnieją w ustalonej kolejności", async () => {
    const { data, error } = await alaClient
      .from("pule")
      .select("klucz")
      .order("kolejnosc");
    expect(error).toBeNull();
    expect(data!.map((p) => p.klucz)).toEqual(["dzialacze", "swiezaki", "alumni"]);
  });

  it("uczestnik nie zmieni puli zwykłym UPDATE-em", async () => {
    await ustawPule("dzialacze", false, 0);

    const { data } = await alaClient
      .from("pule")
      .update({ otwarta: true, miejsca: 999 })
      .eq("klucz", "dzialacze")
      .select();
    expect(data ?? []).toEqual([]);

    const { data: kontrola } = await admin
      .from("pule")
      .select("otwarta, miejsca")
      .eq("klucz", "dzialacze")
      .single();
    expect(kontrola).toEqual({ otwarta: false, miejsca: 0 });
  });

  it("anonim czyta flagę regulaminu, ale nie terminy retencji", async () => {
    // /regulamin jest publiczny i od tej flagi zależy jego baner.
    const { data } = await anonimowy()
      .from("app_settings")
      .select("key")
      .in("key", ["regulamin_zatwierdzony", "data_konca_jwk", "data_retencji_zgloszen"]);
    expect((data ?? []).map((r) => r.key)).toEqual(["regulamin_zatwierdzony"]);
  });

  it("anonim nie czyta danych wrażliwych", async () => {
    const { data } = await anonimowy().from("dane_wrazliwe").select("registration_id");
    expect(data ?? []).toEqual([]);
  });
});
