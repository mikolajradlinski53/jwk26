import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  firstTeamId,
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

async function adminUzytkownik(tag: string, teamId: string) {
  const user = await czlonek(tag, teamId);
  await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
  return user;
}

describe("księga punktów", () => {
  it("nie pozwala uczestnikowi dopisać sobie punktów", async () => {
    const teamId = await firstTeamId();
    const user = await czlonek("cwaniak", teamId);
    const client = await signIn(user);

    const { error } = await client.from("points_ledger").insert({
      user_id: user.id,
      team_id: teamId,
      delta: 9999,
      category: "admin_adjust",
      reason: "należy mi się",
    });

    expect(error).not.toBeNull();
  });

  it("pozwala adminowi przyznać punkty", async () => {
    const teamId = await firstTeamId();
    const szef = await adminUzytkownik("kaplan", teamId);
    const gracz = await czlonek("gracz", teamId);
    const client = await signIn(szef);

    const { error } = await client.from("points_ledger").insert({
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
    const szef = await adminUzytkownik("archiwista", teamId);
    const client = await signIn(szef);

    const { data: wiersz } = await admin
      .from("points_ledger")
      .insert({ team_id: teamId, delta: 10, category: "test" })
      .select("id")
      .single();

    // Brak polityk UPDATE i DELETE nie powoduje błędu — powoduje, że żaden
    // wiersz nie jest dla tych operacji widoczny. PostgREST zwraca wtedy pustą
    // listę zmienionych wierszy, więc asercja na błędzie niczego by nie złapała.
    const { data: poZmianie } = await client
      .from("points_ledger")
      .update({ delta: 999 })
      .eq("id", wiersz!.id)
      .select();

    const { data: poKasowaniu } = await client
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
