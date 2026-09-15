import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

afterEach(async () => {
  while (sprzatanie.length) await deleteUser(sprzatanie.pop()!);
});

async function nowyUzytkownik(tag: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  return user;
}

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
    const user = await nowyUzytkownik("nazwa");
    const client = await signIn(user);

    const { error } = await client
      .from("profiles")
      .update({ display_name: "Brat Mikołaj" })
      .eq("id", user.id);

    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    expect(data!.display_name).toBe("Brat Mikołaj");
  });

  it("nie pozwala mianować się adminem", async () => {
    const user = await nowyUzytkownik("awans");
    const client = await signIn(user);

    const { error } = await client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", user.id);

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    expect(data!.role).toBe("member");
  });

  it("nie pozwala zaakceptować się samemu", async () => {
    const user = await nowyUzytkownik("akcept");
    const client = await signIn(user);

    const { error } = await client
      .from("profiles")
      .update({ status: "approved" })
      .eq("id", user.id);

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("ukrywa cudze profile przed osobą przed akceptacją", async () => {
    const obcy = await nowyUzytkownik("obcy");
    const patrzacy = await nowyUzytkownik("patrzacy");
    const client = await signIn(patrzacy);

    // RLS nie zwraca błędu przy odczycie, tylko pusty zbiór —
    // asercja na error niczego by tu nie wykryła.
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", obcy.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
