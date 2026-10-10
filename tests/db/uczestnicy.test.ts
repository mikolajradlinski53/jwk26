import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";
import { wczytajUczestnikow, wierszCsv, NAGLOWKI_CSV } from "../../src/lib/zapisy/uczestnicy";

// Dwie przyjęte osoby w różnych drużynach i pulach, jedna oczekująca, admin
// i zwykły uczestnik. Dane zakładamy raz - testy tylko czytają.
let przyjety: TestUser;
let przyjeta: TestUser;
let czekajacy: TestUser;
let szef: TestUser;
let szefClient: SupabaseClient;
let przyjetyClient: SupabaseClient;
let druzynaA: string;
let druzynaB: string;

beforeAll(async () => {
  [druzynaA, druzynaB] = await idDruzyn();
  [przyjety, przyjeta, czekajacy, szef] = await Promise.all([
    createUser("przyjety-lista"),
    createUser("przyjeta-lista"),
    createUser("czekajacy-lista"),
    createUser("szef-lista"),
  ]);
  await makeAdmin(szef);
  await ustawJakoZaakceptowany(przyjety, druzynaA);
  await ustawJakoZaakceptowany(przyjeta, druzynaB);

  const wiersz = (user: TestUser, nadpisz: Record<string, unknown>) => ({
    user_id: user.id,
    full_name: "x",
    proof_path: `${user.id}/dowod.jpg`,
    status: "approved",
    pula: "dzialacze",
    imie: "Jan",
    nazwisko: "Zeta",
    ksywka: "Brat Zeta",
    dojazd: "autokar_oba",
    zgoda_wizerunek: true,
    zwolnienie_od: null,
    zwolnienie_do: null,
    alkohol: null,
    ...nadpisz,
  });

  const { data, error } = await admin
    .from("registrations")
    .insert([
      wiersz(przyjety, { zwolnienie_od: "12:30", zwolnienie_do: "16:00", alkohol: "czasami" }),
      wiersz(przyjeta, {
        pula: "swiezaki",
        imie: "Ala",
        nazwisko: "Alfa",
        zgoda_wizerunek: false,
        zwolnienie_sloty: ["11:30-13:00", "15:00-16:30"],
      }),
      wiersz(czekajacy, { status: "pending", imie: "Ukryty", nazwisko: "Oczekujacy" }),
    ])
    .select("id, user_id");
  if (error) throw error;

  const idPrzyjetego = data!.find((r) => r.user_id === przyjety.id)!.id;
  const { error: bladWrazliwych } = await admin.from("dane_wrazliwe").insert({
    registration_id: idPrzyjetego,
    ice_imie: "Anna",
    ice_relacja: "mama",
    ice_telefon: "600200300",
    ice_poinformowany: true,
    dieta: "wegetariańska",
    zgoda_art9_at: new Date().toISOString(),
  });
  if (bladWrazliwych) throw bladWrazliwych;

  szefClient = await signIn(szef);
  przyjetyClient = await signIn(przyjety);
});

afterAll(async () => {
  await admin
    .from("registrations")
    .delete()
    .in("user_id", [przyjety.id, przyjeta.id, czekajacy.id]);
  await Promise.all([przyjety, przyjeta, czekajacy, szef].map(deleteUser));
});

/** Tylko osoby z tego pliku - w bazie testowej mogą być zgłoszenia innych plików. */
function nasi<T extends { userId: string }>(lista: T[]): T[] {
  const id = new Set([przyjety.id, przyjeta.id, czekajacy.id]);
  return lista.filter((u) => id.has(u.userId));
}

describe("lista przyjętych", () => {
  it("admin widzi przyjętych z drużyną i danymi wrażliwymi, bez oczekujących", async () => {
    const lista = nasi(await wczytajUczestnikow(szefClient, {}));
    // Posortowane po nazwisku: Alfa przed Zetą.
    expect(lista.map((u) => u.nazwisko)).toEqual(["Alfa", "Zeta"]);

    const jan = lista.find((u) => u.userId === przyjety.id)!;
    expect(jan.druzyna).toBeTruthy();
    // Stare zgłoszenie (od-do) i nowe (przedziały) - oba czytelne.
    expect(jan.zwolnienie).toBe("12:30-16:00");
    expect(jan.alkohol).toBe("czasami");
    expect(jan.wrazliwe).toMatchObject({
      dieta: "wegetariańska",
      ice_imie: "Anna",
      ice_relacja: "mama",
    });

    const ala = lista.find((u) => u.userId === przyjeta.id)!;
    expect(ala.zwolnienie).toBe("11:30-13:00, 15:00-16:30");
    expect(ala.wrazliwe).toBeNull();
    expect(ala.zgodaWizerunek).toBe(false);
  });

  it("filtr puli i drużyny zawęża listę", async () => {
    const swiezaki = nasi(await wczytajUczestnikow(szefClient, { pula: "swiezaki" }));
    expect(swiezaki.map((u) => u.userId)).toEqual([przyjeta.id]);

    const zDruzynyA = nasi(await wczytajUczestnikow(szefClient, { druzyna: druzynaA }));
    expect(zDruzynyA.map((u) => u.userId)).toEqual([przyjety.id]);
  });

  it("zwykły uczestnik nie widzi cudzych danych", async () => {
    // RLS wpuszcza do registrations tylko własne wiersze, a do dane_wrazliwe
    // tylko własne i admina - lista uczestnika to co najwyżej on sam.
    const lista = await wczytajUczestnikow(przyjetyClient, {});
    expect(lista.every((u) => u.userId === przyjety.id)).toBe(true);
  });

  it("wiersz CSV ma tyle pól, ile nagłówków, w tej samej kolejności", async () => {
    const jan = nasi(await wczytajUczestnikow(szefClient, {})).find(
      (u) => u.userId === przyjety.id,
    )!;
    const wiersz = wierszCsv(jan);
    expect(wiersz).toHaveLength(NAGLOWKI_CSV.length);
    expect(wiersz[NAGLOWKI_CSV.indexOf("Dieta")]).toBe("wegetariańska");
    expect(wiersz[NAGLOWKI_CSV.indexOf("ICE")]).toBe("Anna (mama), 600200300");
  });
});
