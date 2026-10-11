import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  ustawUstawienie,
  type TestUser,
} from "../helpers/supabase";

// Limit drużyny (2026-10-11: 6 drużyn po 9 osób). Test ustawia limit 1,
// żeby nie zakładać dziewięciu kont.
let szef: TestUser;
let kadra: TestUser;
let a: TestUser;
let b: TestUser;
let szefClient: SupabaseClient;
let druzyna: string;

async function zgloszenie(u: TestUser): Promise<string> {
  const { data, error } = await admin
    .from("registrations")
    .insert({ user_id: u.id, full_name: "x", proof_path: `${u.id}/d.jpg`, status: "pending", pula: "dzialacze", ksywka: "x" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

beforeAll(async () => {
  [szef, kadra, a, b] = await Promise.all(["szef", "kadra", "a", "b"].map((t) => createUser(`${t}-limit`)));
  await Promise.all([makeAdmin(szef), makeAdmin(kadra)]);
  szefClient = await signIn(szef);
  const druzyny = await idDruzyn();
  druzyna = druzyny[druzyny.length - 1];
  // Kadra w drużynie - nie zajmuje miejsca uczestnika.
  await admin.from("profiles").update({ team_id: druzyna }).eq("id", kadra.id);
  await ustawUstawienie("druzyna_limit", 1);
});

afterAll(async () => {
  await ustawUstawienie("druzyna_limit", 9);
  await admin.from("registrations").delete().in("user_id", [a.id, b.id]);
  await Promise.all([szef, kadra, a, b].map(deleteUser));
});

describe("limit drużyny", () => {
  it("jest sześć drużyn", async () => {
    expect(await idDruzyn()).toHaveLength(6);
  });

  it("pierwsza osoba wchodzi mimo admina w drużynie, druga odbija się od limitu", async () => {
    const pierwsza = await szefClient.rpc("review_registration", {
      p_registration_id: await zgloszenie(a),
      p_approve: true,
      p_team_id: druzyna,
    });
    expect(pierwsza.error).toBeNull();

    const druga = await szefClient.rpc("review_registration", {
      p_registration_id: await zgloszenie(b),
      p_approve: true,
      p_team_id: druzyna,
    });
    expect(druga.error!.message).toMatch(/DRUZYNA_PELNA/);

    const { data } = await admin.from("profiles").select("status, team_id").eq("id", b.id).single();
    expect(data).toEqual({ status: "pending", team_id: null });
  });
});
