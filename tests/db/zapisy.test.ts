import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
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

beforeEach(async () => {
  // Testy, które badają roboczy regulamin, przestawiają flagę same.
  // afterAll i tak zostawia ją na false.
  await ustawUstawienie("regulamin_zatwierdzony", true);
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

describe("składanie zgłoszenia", () => {
  it("zapisuje na miejsce, a dane zdrowotne osobno", async () => {
    await ustawPule("dzialacze", true, 10);

    const { data, error } = await zloz(alaClient, ala, {
      wrazliwe: { dieta: "wegetariańska", zgoda_art9: true },
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ rezerwa: false });

    const { data: z } = await admin
      .from("registrations")
      .select("*")
      .eq("user_id", ala.id)
      .single();
    expect(z).toMatchObject({
      pula: "dzialacze",
      imie: "Brat",
      nazwisko: "Testowy",
      full_name: "Brat Testowy",
      status: "pending",
      rezerwa: false,
      dojazd: "autokar_oba",
      wersja_zgod: "test",
      proof_path: `${ala.id}/dowod.jpg`,
    });
    // Dieta nie ma czego szukać w tabeli, którą czyta każdy select("*").
    expect(z!.diet_notes).toBeNull();

    const { data: w } = await admin
      .from("dane_wrazliwe")
      .select("dieta, zgoda_art9_at")
      .eq("registration_id", z!.id)
      .single();
    expect(w!.dieta).toBe("wegetariańska");
    expect(w!.zgoda_art9_at).not.toBeNull();
  });

  it("bez danych dobrowolnych nie zakłada wiersza wrażliwego", async () => {
    await ustawPule("dzialacze", true, 10);
    const { data, error } = await zloz(alaClient, ala);
    expect(error).toBeNull();

    const { data: w } = await admin
      .from("dane_wrazliwe")
      .select("registration_id")
      .eq("registration_id", (data as { id: string }).id);
    expect(w).toEqual([]);
  });

  it("zamknięta pula odbija zapis", async () => {
    await ustawPule("dzialacze", false, 10);
    const { error } = await zloz(alaClient, ala);
    expect(error!.message).toMatch(/PULA_ZAMKNIETA/);
  });

  it("roboczy regulamin odbija zapis nawet w otwartej puli", async () => {
    // Otwarta wcześniej tura nie może przyjmować zapisów po cofnięciu
    // regulaminu do wersji roboczej (D8).
    await ustawPule("dzialacze", true, 10);
    await ustawUstawienie("regulamin_zatwierdzony", false);
    const { error } = await zloz(alaClient, ala);
    expect(error!.message).toMatch(/PULA_ZAMKNIETA/);
  });

  it("pełna pula: bez zgody na rezerwę PULA_PELNA, z nią kolejny numer w kolejce", async () => {
    await ustawPule("dzialacze", true, 1);
    expect((await zloz(alaClient, ala)).error).toBeNull();

    const odbite = await zloz(olaClient, ola);
    expect(odbite.error!.message).toMatch(/PULA_PELNA/);

    const pierwsza = await zloz(olaClient, ola, { naRezerwe: true, zdjecie: null });
    expect(pierwsza.error).toBeNull();
    expect(pierwsza.data).toMatchObject({ rezerwa: true });

    const druga = await zloz(obcyClient, obcy, { naRezerwe: true, zdjecie: null });
    expect(druga.error).toBeNull();

    const { data } = await admin
      .from("registrations")
      .select("user_id, kolejnosc_rezerwy")
      .eq("rezerwa", true)
      .in("user_id", [ola.id, obcy.id])
      .order("kolejnosc_rezerwy");
    // Numery rosną przez cały czas życia puli, więc sprawdzamy kolejność
    // i odstęp, nie wartość bezwzględną.
    expect(data!.map((x) => x.user_id)).toEqual([ola.id, obcy.id]);
    expect(data![1].kolejnosc_rezerwy).toBe(data![0].kolejnosc_rezerwy + 1);
  });

  it("dwa równoczesne zapisy na ostatnie miejsce: jeden wchodzi, drugi odbity", async () => {
    // Bez blokady wiersza puli oba wywołania policzą zero zajętych i oba
    // wejdą — 41. osoba na 40 miejsc przy otwarciu tury.
    await ustawPule("dzialacze", true, 1);

    const [a, b] = await Promise.all([zloz(alaClient, ala), zloz(olaClient, ola)]);
    const udane = [a, b].filter((r) => r.error === null);
    const odbite = [a, b].filter((r) => r.error !== null);
    expect(udane).toHaveLength(1);
    expect(odbite[0].error!.message).toMatch(/PULA_PELNA/);

    const { data } = await admin
      .from("registrations")
      .select("id")
      .eq("pula", "dzialacze")
      .eq("rezerwa", false)
      .in("user_id", [ala.id, ola.id]);
    expect(data).toHaveLength(1);
  });

  it("miejsce w wolnej puli wymaga zdjęcia przelewu", async () => {
    await ustawPule("dzialacze", true, 10);
    const { error } = await zloz(alaClient, ala, { zdjecie: null });
    expect(error!.message).toMatch(/PRZELEW_WYMAGANY/);
  });

  it("urodzony 23.10.2008 przechodzi, 24.10.2008 nie", async () => {
    await ustawPule("dzialacze", true, 10);

    const wDniuProgu = await zloz(alaClient, ala, { dane: { data_urodzenia: "2008-10-23" } });
    expect(wDniuProgu.error).toBeNull();

    const dzienPozniej = await zloz(olaClient, ola, { dane: { data_urodzenia: "2008-10-24" } });
    expect(dzienPozniej.error!.message).toMatch(/NIEPELNOLETNI/);
  });

  it("numer indeksu wymagany poza pulą Alumni", async () => {
    await ustawPule("dzialacze", true, 10);
    await ustawPule("alumni", true, 10);

    const dzialacz = await zloz(alaClient, ala, { dane: { nr_indeksu: null } });
    expect(dzialacz.error!.message).toMatch(/indeksu/);

    const alumn = await zloz(olaClient, ola, { dane: { pula: "alumni", nr_indeksu: null } });
    expect(alumn.error).toBeNull();
  });

  it("kontakt ICE bez potwierdzenia jest odbity", async () => {
    await ustawPule("dzialacze", true, 10);
    const { error } = await zloz(alaClient, ala, {
      wrazliwe: { ice_imie: "Mama", ice_telefon: "600200300" },
    });
    expect(error!.message).toMatch(/ICE/);
  });

  it("dane o zdrowiu bez zgody są odbite", async () => {
    await ustawPule("dzialacze", true, 10);
    const { error } = await zloz(alaClient, ala, { wrazliwe: { alergie: "orzechy" } });
    expect(error!.message).toMatch(/zdrowiu/);
  });

  it("brak akceptacji regulaminu jest odbity", async () => {
    await ustawPule("dzialacze", true, 10);
    const { error } = await zloz(alaClient, ala, { dane: { akceptuje_regulamin: false } });
    expect(error!.message).toMatch(/akceptacji/);
  });

  it("osoba już zaakceptowana nie złoży nowego zgłoszenia", async () => {
    // Odrzucenie takiego zgłoszenia zbiłoby jej status na 'rejected'
    // i wyrzuciło ją z aplikacji, choć była już w drużynie.
    await ustawPule("dzialacze", true, 10);
    await ustawJakoZaakceptowany(ala);
    const { error } = await zloz(alaClient, ala);
    expect(error!.message).toMatch(/zaakceptowane/);
  });

  it("drugie zgłoszenie w toku jest odbite", async () => {
    await ustawPule("dzialacze", true, 10);
    expect((await zloz(alaClient, ala)).error).toBeNull();
    // Rezerwa też ma status pending, więc ten sam indeks nie pozwoli zapisać
    // się jednocześnie na miejsce i na rezerwę ani do dwóch pul. Asercja na
    // treść, bo „jakikolwiek błąd" przeszedłby też z powodu walidacji.
    const drugie = await zloz(alaClient, ala);
    expect(drugie.error!.message).toMatch(/one_pending|duplicate key/);
  });

  it("po odrzuceniu można złożyć zgłoszenie ponownie", async () => {
    await ustawPule("dzialacze", true, 10);
    const { data } = await zloz(alaClient, ala);
    await admin
      .from("registrations")
      .update({ status: "rejected" })
      .eq("id", (data as { id: string }).id);

    const ponownie = await zloz(alaClient, ala);
    expect(ponownie.error).toBeNull();
  });

  it("ścieżka zdjęcia spoza własnego folderu jest odbita", async () => {
    await ustawPule("dzialacze", true, 10);

    const cudza = await zloz(alaClient, ala, { zdjecie: `${obcy.id}/dowod.jpg` });
    expect(cudza.error!.message).toMatch(/sciezka/);

    // `like 'uuid/%'` sam to przepuszcza, a klient Storage normalizuje `..`
    // przy budowaniu URL-a — admin oglądałby cudzy dowód.
    const wyjscie = await zloz(alaClient, ala, {
      zdjecie: `${ala.id}/../${obcy.id}/dowod.jpg`,
    });
    expect(wyjscie.error!.message).toMatch(/sciezka/);

    // Parser URL zamienia `%2e%2e` na `..`, a storage-js ścieżki nie koduje —
    // to samo obejście bramy, tylko zapisane inaczej.
    const zakodowana = await zloz(alaClient, ala, {
      zdjecie: `${ala.id}/%2e%2e/${obcy.id}/dowod.jpg`,
    });
    expect(zakodowana.error!.message).toMatch(/sciezka/);
  });

  it("cudze dane wrażliwe są niewidoczne, własne widoczne", async () => {
    await ustawPule("dzialacze", true, 10);
    const { data } = await zloz(alaClient, ala, {
      wrazliwe: { choroby_leki: "astma, inhalator", zgoda_art9: true },
    });
    const id = (data as { id: string }).id;

    const { data: swoje } = await alaClient.from("dane_wrazliwe").select("choroby_leki").eq("registration_id", id);
    expect(swoje).toEqual([{ choroby_leki: "astma, inhalator" }]);

    const { data: cudze } = await obcyClient.from("dane_wrazliwe").select("choroby_leki").eq("registration_id", id);
    expect(cudze).toEqual([]);

    // Zapis mimo braku polityki odbija się już na grancie.
    const { error } = await alaClient
      .from("dane_wrazliwe")
      .update({ choroby_leki: "nic" })
      .eq("registration_id", id);
    expect(error).not.toBeNull();
  });
});

/** Składa zgłoszenie tak, jak robi to formularz. */
function zloz(
  client: SupabaseClient,
  user: TestUser,
  opcje: {
    dane?: Record<string, unknown>;
    wrazliwe?: Record<string, unknown> | null;
    /** `undefined` = poprawna ścieżka we własnym folderze, `null` = bez zdjęcia. */
    zdjecie?: string | null;
    naRezerwe?: boolean;
  } = {},
) {
  return client.rpc("zloz_zgloszenie", {
    p_dane: daneZapisu(opcje.dane),
    p_wrazliwe: opcje.wrazliwe ?? null,
    p_proof_path: opcje.zdjecie === undefined ? `${user.id}/dowod.jpg` : opcje.zdjecie,
    p_na_rezerwe: opcje.naRezerwe ?? false,
  });
}
