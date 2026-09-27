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
    // Pusta tabela dałaby [] także bez zabezpieczeń — trzeba sprawdzić błąd, nie dane.
    const { data, error } = await anonimowy().from("dane_wrazliwe").select("registration_id");
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });
});

type Stan = {
  klucz: string;
  otwarta: boolean;
  miejsca: number;
  zajete: number;
  w_rezerwie: number;
};

describe("pule", () => {
  it("stan pul liczy miejsca i rezerwę, pomija odrzucone", async () => {
    await ustawPule("swiezaki", true, 10);
    // Uwaga: bulk insert przez PostgREST dopełnia brakujące klucze wartością
    // NULL zamiast DEFAULT tabeli, gdy wiersze mają różny zestaw kluczy —
    // stąd `status`/`rezerwa` wypisane jawnie we wszystkich trzech wierszach,
    // żeby żaden nie oberwał NULL-em na kolumnie NOT NULL cudzego sąsiada.
    const { error: bladZapisu } = await admin.from("registrations").insert([
      {
        user_id: ala.id,
        full_name: "A",
        proof_path: `${ala.id}/d.jpg`,
        pula: "swiezaki",
        status: "pending",
        rezerwa: false,
      },
      {
        user_id: ola.id,
        full_name: "O",
        proof_path: null,
        pula: "swiezaki",
        status: "pending",
        rezerwa: true,
        kolejnosc_rezerwy: 1,
      },
      {
        user_id: obcy.id,
        full_name: "X",
        proof_path: `${obcy.id}/d.jpg`,
        pula: "swiezaki",
        status: "rejected",
        rezerwa: false,
      },
    ]);
    expect(bladZapisu).toBeNull();

    // Uczestnik nie widzi cudzych zgłoszeń (RLS), więc sam by ich nie
    // policzył. Dlatego stan_pul idzie prawami właściciela.
    const { data, error } = await alaClient.rpc("stan_pul");
    expect(error).toBeNull();
    const swiezaki = (data as Stan[]).find((p) => p.klucz === "swiezaki")!;
    expect(swiezaki).toMatchObject({ otwarta: true, miejsca: 10, zajete: 1, w_rezerwie: 1 });
  });

  it("uczestnik nie zmieni puli funkcją", async () => {
    const { error } = await alaClient.rpc("ustaw_pule", {
      p_klucz: "alumni",
      p_otwarta: true,
      p_miejsca: 5,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/admin/i);
  });

  it("przy roboczym regulaminie otwarcie jest odbite, zamknięcie nie", async () => {
    await ustawUstawienie("regulamin_zatwierdzony", false);

    const otwarcie = await szefClient.rpc("ustaw_pule", {
      p_klucz: "alumni",
      p_otwarta: true,
      p_miejsca: 5,
    });
    expect(otwarcie.error!.message).toMatch(/REGULAMIN_ROBOCZY/);

    // Zmiana liczby miejsc przy zamkniętej puli ma przechodzić — admin
    // przygotowuje tury, zanim zarząd przyjmie regulamin.
    const przygotowanie = await szefClient.rpc("ustaw_pule", {
      p_klucz: "alumni",
      p_otwarta: false,
      p_miejsca: 5,
    });
    expect(przygotowanie.error).toBeNull();

    const { data } = await admin.from("pule").select("otwarta, miejsca").eq("klucz", "alumni").single();
    expect(data).toEqual({ otwarta: false, miejsca: 5 });
  });

  it("po zatwierdzeniu regulaminu admin otwiera pulę", async () => {
    await ustawUstawienie("regulamin_zatwierdzony", true);

    const { error } = await szefClient.rpc("ustaw_pule", {
      p_klucz: "alumni",
      p_otwarta: true,
      p_miejsca: 7,
    });
    expect(error).toBeNull();

    const { data } = await admin.from("pule").select("otwarta, miejsca").eq("klucz", "alumni").single();
    expect(data).toEqual({ otwarta: true, miejsca: 7 });
  });

  it("pozycja w rezerwie liczy tylko czekających przed tobą", async () => {
    const { error: bladZapisu } = await admin.from("registrations").insert([
      { user_id: ala.id, full_name: "A", pula: "dzialacze", rezerwa: true, kolejnosc_rezerwy: 10 },
      { user_id: obcy.id, full_name: "X", pula: "dzialacze", rezerwa: true, kolejnosc_rezerwy: 11 },
    ]);
    expect(bladZapisu).toBeNull();

    expect((await alaClient.rpc("pozycja_w_rezerwie")).data).toBe(1);
    expect((await obcyClient.rpc("pozycja_w_rezerwie")).data).toBe(2);
    // Ktoś spoza rezerwy nie ma pozycji — null, nie „1".
    expect((await olaClient.rpc("pozycja_w_rezerwie")).data).toBeNull();
  });
});
