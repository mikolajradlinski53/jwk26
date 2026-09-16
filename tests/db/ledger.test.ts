import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  firstTeamId,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

afterEach(async () => {
  while (sprzatanie.length) {
    const user = sprzatanie.pop()!;
    await admin.from("points_ledger").delete().eq("user_id", user.id);
    await deleteUser(user);
  }
});

async function czlonek(tag: string, teamId: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  await admin
    .from("profiles")
    .update({ status: "approved", team_id: teamId, display_name: tag })
    .eq("id", user.id);
  return user;
}

// Jeden zwykły członek drużyny i jeden admin na cały plik. Żaden z pięciu
// testów nie bada rozróżnienia między dwiema konkretnymi osobami tego samego
// typu — tylko to, co wolno roli. is_admin() czyta rolę na żywo z profili.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let szef: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  const teamId = await firstTeamId();

  uczestnik = await createUser("uczestnik-ksiega");
  await admin
    .from("profiles")
    .update({ status: "approved", team_id: teamId })
    .eq("id", uczestnik.id);
  uczestnikClient = await signIn(uczestnik);

  szef = await createUser("kaplan-ksiega");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await admin.from("points_ledger").delete().eq("user_id", uczestnik.id);
  await deleteUser(uczestnik);
  await admin.from("points_ledger").delete().eq("user_id", szef.id);
  await deleteUser(szef);
});

describe("księga punktów", () => {
  it("nie pozwala uczestnikowi dopisać sobie punktów", async () => {
    const teamId = await firstTeamId();

    const { error } = await uczestnikClient.from("points_ledger").insert({
      user_id: uczestnik.id,
      team_id: teamId,
      delta: 9999,
      category: "admin_adjust",
      reason: "należy mi się",
    });

    expect(error).not.toBeNull();
  });

  it("pozwala adminowi przyznać punkty", async () => {
    const teamId = await firstTeamId();
    const gracz = await czlonek("gracz", teamId);

    const { error } = await adminClient.from("points_ledger").insert({
      user_id: gracz.id,
      team_id: teamId,
      delta: 50,
      category: "admin_adjust",
      reason: "wygrane zadanie",
      awarded_by: szef.id,
    });

    expect(error).toBeNull();
  });

  it("nie pozwala nikomu zmienić ani skasować historii", async () => {
    const teamId = await firstTeamId();

    const { data: wiersz } = await admin
      .from("points_ledger")
      .insert({ team_id: teamId, delta: 10, category: "test" })
      .select("id")
      .single();

    // Brak polityk UPDATE i DELETE nie powoduje błędu — powoduje, że żaden
    // wiersz nie jest dla tych operacji widoczny. PostgREST zwraca wtedy pustą
    // listę zmienionych wierszy, więc asercja na błędzie niczego by nie złapała.
    const { data: poZmianie } = await adminClient
      .from("points_ledger")
      .update({ delta: 999 })
      .eq("id", wiersz!.id)
      .select();

    const { data: poKasowaniu } = await adminClient
      .from("points_ledger")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(poZmianie).toEqual([]);
    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin
      .from("points_ledger")
      .select("delta")
      .eq("id", wiersz!.id)
      .single();
    expect(kontrola!.delta).toBe(10);

    await admin.from("points_ledger").delete().eq("id", wiersz!.id);
  });

  it("sumuje wynik drużyny z wierszy księgi", async () => {
    const teamId = await firstTeamId();
    const gracz = await czlonek("sumator", teamId);

    const { data: przed } = await admin
      .from("team_scores")
      .select("score")
      .eq("team_id", teamId)
      .single();

    await admin.from("points_ledger").insert([
      { user_id: gracz.id, team_id: teamId, delta: 30, category: "bingo" },
      { user_id: null, team_id: teamId, delta: -10, category: "shop" },
    ]);

    const { data: po } = await admin
      .from("team_scores")
      .select("score")
      .eq("team_id", teamId)
      .single();

    expect(po!.score).toBe(przed!.score + 20);

    // Wiersz drużynowy nie ma user_id, więc afterEach go nie posprząta.
    await admin
      .from("points_ledger")
      .delete()
      .is("user_id", null)
      .eq("team_id", teamId)
      .eq("category", "shop");
  });

  it("nie obciąża wyniku indywidualnego wydatkiem drużynowym", async () => {
    const teamId = await firstTeamId();
    const kapitan = await czlonek("kapitan", teamId);

    await admin.from("points_ledger").insert([
      { user_id: kapitan.id, team_id: teamId, delta: 100, category: "bingo" },
      // Zakup w sklepiku: obciąża drużynę, ale nie kapitana.
      {
        user_id: null,
        team_id: teamId,
        delta: -60,
        category: "shop",
        awarded_by: kapitan.id,
      },
    ]);

    const { data } = await admin
      .from("user_scores")
      .select("score")
      .eq("user_id", kapitan.id)
      .single();

    expect(data!.score).toBe(100);

    await admin
      .from("points_ledger")
      .delete()
      .is("user_id", null)
      .eq("team_id", teamId)
      .eq("category", "shop");
  });
});
