import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  firstTeamId,
  ustawJakoZaakceptowany,
  ustawPule,
  ustawUstawienie,
  daneZapisu,
  type TestUser,
} from "../helpers/supabase";

// Admini dostali dostęp ręcznie, z pominięciem formularza, a też jadą -
// więc zloz_zgloszenie() ma ich przepuścić, ale tylko raz.
let szef: TestUser;
let uczestnik: TestUser;
let szefClient: SupabaseClient;
let uczestnikClient: SupabaseClient;

beforeAll(async () => {
  const druzyna = await firstTeamId();
  [szef, uczestnik] = await Promise.all([createUser("szef-formularz"), createUser("uczestnik-formularz")]);
  await makeAdmin(szef);
  await ustawJakoZaakceptowany(szef, druzyna);
  await ustawJakoZaakceptowany(uczestnik, druzyna);
  szefClient = await signIn(szef);
  uczestnikClient = await signIn(uczestnik);
  await ustawUstawienie("regulamin_zatwierdzony", true);
  await ustawPule("dzialacze", true, 50);
});

afterEach(async () => {
  await admin.from("registrations").delete().in("user_id", [szef.id, uczestnik.id]);
});

afterAll(async () => {
  await ustawPule("dzialacze", false, 0);
  await ustawUstawienie("regulamin_zatwierdzony", false);
  await Promise.all([szef, uczestnik].map(deleteUser));
});

function zloz(client: SupabaseClient, user: TestUser) {
  return client.rpc("zloz_zgloszenie", {
    p_dane: daneZapisu(),
    p_wrazliwe: null,
    p_proof_path: `${user.id}/dowod.jpg`,
    p_na_rezerwe: false,
  });
}

describe("admin przez formularz", () => {
  it("przyjęty admin bez zgłoszenia składa je jak wszyscy", async () => {
    const { error } = await zloz(szefClient, szef);
    expect(error).toBeNull();
    const { data } = await admin.from("registrations").select("status").eq("user_id", szef.id).single();
    expect(data!.status).toBe("pending");
  });

  it("drugie zgłoszenie admina odpada", async () => {
    expect((await zloz(szefClient, szef)).error).toBeNull();
    const { error } = await zloz(szefClient, szef);
    expect(error!.message).toMatch(/juz zaakceptowane/);
  });

  it("przyjęty uczestnik (nie admin) nadal nie złoży drugiego zgłoszenia", async () => {
    const { error } = await zloz(uczestnikClient, uczestnik);
    expect(error!.message).toMatch(/juz zaakceptowane/);
  });

  it("odrzucenie zgłoszenia admina nie zabiera mu dostępu", async () => {
    await zloz(szefClient, szef);
    const { data: zgl } = await admin.from("registrations").select("id").eq("user_id", szef.id).single();
    const { error } = await szefClient.rpc("review_registration", { p_registration_id: zgl!.id, p_approve: false });
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("status, role").eq("id", szef.id).single();
    expect(data).toEqual({ status: "approved", role: "admin" });
  });
});
