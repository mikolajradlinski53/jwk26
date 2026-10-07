import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { admin, ustawPule, ustawUstawienie, daneZapisu } from "../helpers/supabase";

// Świeżaki logują się prywatnym mailem (decyzja 2026-10-07). Taki adres
// zapisuje się wyłącznie do tury Świeżaków; organizator sprawdza przy
// akceptacji, czy to faktycznie Świeżak.
const HASLO = "rytual-testowy-2026";
let id: string;
let email: string;
let klient: SupabaseClient;
let odId = 0;

beforeAll(async () => {
  email = `test.swiezak.${Math.random().toString(36).slice(2, 8)}@gmail.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: HASLO, email_confirm: true });
  if (error) throw error;
  id = data.user.id;
  klient = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: e2 } = await klient.auth.signInWithPassword({ email, password: HASLO });
  if (e2) throw e2;
  await ustawUstawienie("regulamin_zatwierdzony", true);
  await ustawPule("dzialacze", true, 50);
  await ustawPule("alumni", true, 50);
  await ustawPule("swiezaki", true, 50);
  const { data: ost } = await admin.from("maile_zgloszen_log").select("id").order("id", { ascending: false }).limit(1);
  odId = (ost?.[0]?.id as number | undefined) ?? 0;
});

afterEach(async () => {
  await admin.from("registrations").delete().eq("user_id", id);
});

afterAll(async () => {
  await ustawPule("dzialacze", false, 0);
  await ustawPule("alumni", false, 0);
  await ustawPule("swiezaki", false, 0);
  await ustawUstawienie("regulamin_zatwierdzony", false);
  await admin.from("maile_zgloszen_log").delete().gt("id", odId);
  await admin.auth.admin.deleteUser(id);
});

function zloz(pula: string) {
  return klient.rpc("zloz_zgloszenie", {
    p_dane: daneZapisu({ pula, nr_indeksu: pula === "alumni" ? null : "123456" }),
    p_wrazliwe: null,
    p_proof_path: `${id}/dowod.jpg`,
    p_na_rezerwe: false,
  });
}

describe("prywatny mail przy zapisach", () => {
  it("nie zapisze się do Działaczy ani Alumnów", async () => {
    expect((await zloz("dzialacze")).error?.message).toMatch(/TURA_TYLKO_SAMORZAD/);
    expect((await zloz("alumni")).error?.message).toMatch(/TURA_TYLKO_SAMORZAD/);
  });

  it("zapisze się do Świeżaków, a mail do organizatorów ostrzega i podaje adres", async () => {
    expect((await zloz("swiezaki")).error).toBeNull();
    const { data } = await admin
      .from("maile_zgloszen_log")
      .select("tresc")
      .eq("rodzaj", "zgloszenie")
      .gt("id", odId)
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(data!.tresc).toContain(email);
    expect(data!.tresc).toMatch(/spoza Samorządu - sprawdź, czy to Świeżak/);
  });
});
