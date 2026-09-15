import { describe, it, expect } from "vitest";
import { admin, createUser, deleteUser } from "../helpers/supabase";

// GoTrue nie przepuszcza treści wyjątku z Postgresa do klienta API — zwraca
// generyczne "Database error creating new user". Asercja na tekst komunikatu
// byłaby więc bezwartościowa. Dowodem, że zadziałała bramka, jest brak konta:
// gdyby trigger przepuścił adres, handle_new_user założyłby profil.
async function odrzucaAdres(email: string) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: "cokolwiek-12345",
    email_confirm: true,
  });
  expect(error).not.toBeNull();

  const { data } = await admin.from("profiles").select("id").eq("email", email);
  expect(data).toEqual([]);
}

describe("bramka domenowa", () => {
  it("odrzuca adres spoza @samorzad.ue.wroc.pl", async () => {
    await odrzucaAdres("obcy@gmail.com");
  });

  it("odrzuca adres z domeną jako prefiksem", async () => {
    // Bez kotwicy na końcu wzorca like, adres ...wroc.pl.evil.com przeszedłby.
    await odrzucaAdres("spryciarz@samorzad.ue.wroc.pl.evil.com");
  });

  it("wpuszcza adres w dozwolonej domenie", async () => {
    const user = await createUser("brama");
    expect(user.id).toBeTruthy();
    await deleteUser(user);
  });
});
