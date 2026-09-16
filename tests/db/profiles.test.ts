import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

async function nowyUzytkownik(tag: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  return user;
}

// Jedna zwykła sesja na cały plik: granty kolumnowe i is_approved() czytają
// rolę/status na żywo z profili, więc te same reguły widać bez logowania się
// od nowa za każdym razem. Test zakładania profilu potrzebuje świeżego
// użytkownika — bada sam moment jego powstania — więc jego nie ruszamy.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;

beforeAll(async () => {
  uczestnik = await createUser("uczestnik-profile");
  uczestnikClient = await signIn(uczestnik);
});

afterAll(async () => {
  await deleteUser(uczestnik);
});

afterEach(async () => {
  // Test zmiany nazwy zostawia trwały ślad na współdzielonym koncie — reset,
  // żeby kolejny test zawsze widział domyślny (pusty) profil.
  await admin.from("profiles").update({ display_name: null }).eq("id", uczestnik.id);
  while (sprzatanie.length) await deleteUser(sprzatanie.pop()!);
});

describe("profile", () => {
  it("zakłada profil automatycznie ze statusem pending", async () => {
    const user = await nowyUzytkownik("profil");

    const { data, error } = await admin
      .from("profiles")
      .select("email, role, status, team_id")
      .eq("id", user.id)
      .single();

    expect(error).toBeNull();
    expect(data!.email).toBe(user.email);
    expect(data!.role).toBe("member");
    expect(data!.status).toBe("pending");
    expect(data!.team_id).toBeNull();
  });

  it("pozwala zmienić własną nazwę wyświetlaną", async () => {
    const { error } = await uczestnikClient
      .from("profiles")
      .update({ display_name: "Brat Mikołaj" })
      .eq("id", uczestnik.id);

    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", uczestnik.id)
      .single();
    expect(data!.display_name).toBe("Brat Mikołaj");
  });

  it("nie pozwala mianować się adminem", async () => {
    const { error } = await uczestnikClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", uczestnik.id);

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", uczestnik.id)
      .single();
    expect(data!.role).toBe("member");
  });

  it("nie pozwala zaakceptować się samemu", async () => {
    const { error } = await uczestnikClient
      .from("profiles")
      .update({ status: "approved" })
      .eq("id", uczestnik.id);

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", uczestnik.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("ukrywa cudze profile przed osobą przed akceptacją", async () => {
    const obcy = await nowyUzytkownik("obcy");

    const { data, error } = await uczestnikClient
      .from("profiles")
      .select("id")
      .eq("id", obcy.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
