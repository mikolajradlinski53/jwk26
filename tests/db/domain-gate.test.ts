import { describe, it, expect } from "vitest";
import { admin, createUser, deleteUser } from "../helpers/supabase";

// Od 2026-10-07 bramka nie sprawdza domeny (Świeżaki logują się prywatnymi
// mailami) - pilnuje już tylko, żeby konto miało adres e-mail. To, do której
// tury zapisze się prywatny mail, sprawdza zloz_zgloszenie
// (tests/db/swiezaki-prywatne.test.ts).
describe("bramka kont", () => {
  it("wpuszcza prywatny adres i zakłada profil", async () => {
    const email = `test.prywatny.${Math.random().toString(36).slice(2, 8)}@gmail.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "cokolwiek-12345",
      email_confirm: true,
    });
    expect(error).toBeNull();
    const { data: profil } = await admin.from("profiles").select("email").eq("id", data.user!.id).single();
    expect(profil!.email).toBe(email);
    await admin.auth.admin.deleteUser(data.user!.id);
  });

  it("wpuszcza adres w domenie Samorządu", async () => {
    const user = await createUser("brama");
    expect(user.id).toBeTruthy();
    await deleteUser(user);
  });

  it("odrzuca konto bez adresu e-mail (sam numer telefonu)", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      phone: `+48600${Math.floor(100000 + Math.random() * 899999)}`,
      password: "cokolwiek-12345",
      phone_confirm: true,
    });
    if (data.user) await admin.auth.admin.deleteUser(data.user.id);
    expect(error).not.toBeNull();
  });
});

describe("konto_samorzadowe()", () => {
  it("rozpoznaje domenę z kotwicą na końcu", async () => {
    const sprawdz = async (email: string | null) =>
      (await admin.rpc("konto_samorzadowe", { p_email: email })).data as boolean;
    expect(await sprawdz("Jan.Kowalski@Samorzad.UE.wroc.pl")).toBe(true);
    expect(await sprawdz("spryciarz@samorzad.ue.wroc.pl.evil.com")).toBe(false);
    expect(await sprawdz("ktos@gmail.com")).toBe(false);
    expect(await sprawdz(null)).toBe(false);
  });
});
