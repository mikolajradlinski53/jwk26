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

  it("przyjęcie bez drużyny, potem przydział z limitem i przeniesienie", async () => {
    const bez = await szefClient.rpc("review_registration", {
      p_registration_id: (await admin.from("registrations").select("id").eq("user_id", b.id).single()).data!.id,
      p_approve: true,
      p_team_id: null,
    });
    expect(bez.error).toBeNull();
    let { data } = await admin.from("profiles").select("status, team_id").eq("id", b.id).single();
    expect(data).toEqual({ status: "approved", team_id: null });

    // Drużyna z limitem 1 ma już osobę a - b tam nie wejdzie.
    expect((await szefClient.rpc("przydziel_druzyne", { p_user: b.id, p_team: druzyna })).error!.message).toMatch(/DRUZYNA_PELNA/);
    const inna = (await idDruzyn()).find((d) => d !== druzyna)!;
    expect((await szefClient.rpc("przydziel_druzyne", { p_user: b.id, p_team: inna })).error).toBeNull();
    ({ data } = await admin.from("profiles").select("status, team_id").eq("id", b.id).single());
    expect(data!.team_id).toBe(inna);

    // Zdjęcie z drużyny i rozdzielenie automatyczne do wolnej.
    expect((await szefClient.rpc("przydziel_druzyne", { p_user: b.id, p_team: null })).error).toBeNull();
    const { data: wynik, error } = await szefClient.rpc("rozdziel_bez_druzyny");
    expect(error).toBeNull();
    expect((wynik as { przydzielono: number }).przydzielono).toBeGreaterThanOrEqual(1);
    ({ data } = await admin.from("profiles").select("team_id").eq("id", b.id).single());
    expect(data!.team_id).not.toBeNull();
    expect(data!.team_id).not.toBe(druzyna);
  });

  it("uczestnik nie przydziela drużyn", async () => {
    const k = await signIn(a);
    expect((await k.rpc("rozdziel_bez_druzyny")).error).not.toBeNull();
    expect((await k.rpc("przydziel_druzyne", { p_user: a.id, p_team: null })).error).not.toBeNull();
  });
});
