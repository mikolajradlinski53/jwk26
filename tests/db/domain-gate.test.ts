import { describe, it, expect } from "vitest";
import { admin, createUser, deleteUser } from "../helpers/supabase";

describe("bramka domenowa", () => {
  it("odrzuca adres spoza @samorzad.ue.wroc.pl", async () => {
    const { error } = await admin.auth.admin.createUser({
      email: "obcy@gmail.com",
      password: "cokolwiek-12345",
      email_confirm: true,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/samorzad\.ue\.wroc\.pl/);
  });

  it("odrzuca adres z domeną jako prefiksem", async () => {
    // Bez kotwicy na końcu wzorca like, adres ...wroc.pl.evil.com przeszedłby.
    const { error } = await admin.auth.admin.createUser({
      email: "spryciarz@samorzad.ue.wroc.pl.evil.com",
      password: "cokolwiek-12345",
      email_confirm: true,
    });

    expect(error).not.toBeNull();
  });

  it("wpuszcza adres w dozwolonej domenie", async () => {
    const user = await createUser("brama");
    expect(user.id).toBeTruthy();
    await deleteUser(user);
  });
});
