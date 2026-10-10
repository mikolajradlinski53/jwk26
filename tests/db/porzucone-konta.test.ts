import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

// Ktoś zalogował się kodem, ale nie złożył zgłoszenia - po 48 h konto znika.
// Świeżego konta nie da się postarzyć, więc test woła funkcję z progiem 0.
let porzucony: TestUser;
let zeZgloszeniem: TestUser;
let szef: TestUser;

async function istnieje(user: TestUser): Promise<boolean> {
  const { data } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  return data !== null;
}

beforeAll(async () => {
  [porzucony, zeZgloszeniem, szef] = await Promise.all([
    createUser("porzucony"),
    createUser("ze-zgloszeniem"),
    createUser("szef-porzucone"),
  ]);
  await makeAdmin(szef);
  const { error } = await admin.from("registrations").insert({
    user_id: zeZgloszeniem.id,
    full_name: "x",
    proof_path: `${zeZgloszeniem.id}/dowod.jpg`,
    status: "pending",
    pula: "dzialacze",
    imie: "Jan",
    nazwisko: "Zgloszony",
    dojazd: "autokar_oba",
    zgoda_wizerunek: false,
  });
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all([porzucony, zeZgloszeniem, szef].map((u) => deleteUser(u)));
});

describe("porzucone konta", () => {
  it("świeże konto bez zgłoszenia zostaje przy domyślnych 48 h", async () => {
    const { error } = await admin.rpc("usun_porzucone_konta");
    expect(error).toBeNull();
    expect(await istnieje(porzucony)).toBe(true);
  });

  it("uczestnik nie wywoła kasowania", async () => {
    const klient = await signIn(zeZgloszeniem);
    const { error } = await klient.rpc("usun_porzucone_konta", { p_starsze_niz: "0 seconds" });
    expect(error).not.toBeNull();
  });

  it("po terminie znika tylko konto bez zgłoszenia - admin i zgłoszony zostają", async () => {
    const { data, error } = await admin.rpc("usun_porzucone_konta", { p_starsze_niz: "0 seconds" });
    expect(error).toBeNull();
    expect(data).toBeGreaterThanOrEqual(1);

    expect(await istnieje(porzucony)).toBe(false);
    const { data: auth } = await admin.auth.admin.getUserById(porzucony.id);
    expect(auth.user).toBeNull();

    expect(await istnieje(zeZgloszeniem)).toBe(true);
    expect(await istnieje(szef)).toBe(true);
  });
});
