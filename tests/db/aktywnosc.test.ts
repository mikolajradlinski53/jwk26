import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  firstTeamId,
  idZadania,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

// Panel „Aktywność”: zestawienie z istniejących danych, tylko dla adminów,
// bez nominacji JWK Awards (regulamin § 19 ust. 6).
let szef: TestUser;
let gracz: TestUser;
let szefClient: SupabaseClient;
let graczClient: SupabaseClient;

beforeAll(async () => {
  [szef, gracz] = await Promise.all([createUser("szef-aktywnosc"), createUser("gracz-aktywnosc")]);
  await makeAdmin(szef);
  const team = await firstTeamId();
  await ustawJakoZaakceptowany(gracz, team);
  szefClient = await signIn(szef);
  graczClient = await signIn(gracz);
  await admin.from("bingo_submissions").insert({
    user_id: gracz.id,
    team_id: team,
    task_id: await idZadania(5),
    photo_path: `${gracz.id}/a.jpg`,
  });
  await admin.from("kruk_gry").insert({ user_id: gracz.id });
  await admin.from("push_subscriptions").insert({
    user_id: gracz.id,
    endpoint: `https://push.example/${gracz.id}`,
    p256dh: "x",
    auth: "y",
  });
});

afterAll(async () => {
  await admin.from("bingo_submissions").delete().eq("user_id", gracz.id);
  await Promise.all([szef, gracz].map(deleteUser));
});

describe("aktywnosc_uczestnikow", () => {
  it("admin widzi logowanie, powiadomienia i zliczenia z zabaw", async () => {
    const { data, error } = await szefClient.rpc("aktywnosc_uczestnikow");
    expect(error).toBeNull();
    const w = (data as Record<string, unknown>[]).find((r) => r.id === gracz.id)!;
    expect(w).toMatchObject({ status: "approved", powiadomienia: true, bingo: 1, gry: 1, feed: 0, sklep: 0, zawody: 0 });
    expect(w.ostatnie_logowanie).not.toBeNull();
    expect(Object.keys(w).some((k) => /nomin|gossip/.test(k))).toBe(false);
  });

  it("uczestnik nie zobaczy zestawienia", async () => {
    const { error } = await graczClient.rpc("aktywnosc_uczestnikow");
    expect(error!.message).toMatch(/Tylko admin/);
  });
});
