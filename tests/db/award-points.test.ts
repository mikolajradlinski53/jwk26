import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  signIn,
  anonimowy,
  firstTeamId,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();

afterEach(async () => {
  await admin.from("points_ledger").delete().eq("category", "admin_adjust");
  await posprzataj();
});

describe("przyznawanie punktów", () => {
  it("nie pozwala uczestnikowi przyznać punktów", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("chytrus");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);

    const { error } = await client.rpc("award_points", {
      p_delta: 500,
      p_reason: "bo tak",
      p_user_id: user.id,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala wywołać funkcji bez zalogowania", async () => {
    const { error } = await anonimowy().rpc("award_points", {
      p_delta: 10,
      p_reason: "z ulicy",
    });

    expect(error).not.toBeNull();
    // Gdyby grant dla anona został, funkcja weszłaby do ciała i padła na
    // strażniku is_admin() — komunikatem o adminie.
    expect(error!.message).not.toMatch(/admin/i);
  });

  it("przyznaje punkty osobie i wywodzi drużynę z profilu", async () => {
    const teamId = await firstTeamId();
    const gracz = await nowyUzytkownik("nagrodzony");
    await ustawJakoZaakceptowany(gracz, teamId);
    const szef = await nowyAdmin("kaplan-punkty");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 40,
      p_reason: "wygrana konkurencja przy ognisku",
      p_user_id: gracz.id,
    });

    expect(error).toBeNull();

    const { data } = await admin
      .from("points_ledger")
      .select("user_id, team_id, delta, category, reason, awarded_by")
      .eq("user_id", gracz.id)
      .single();

    expect(data!.team_id).toBe(teamId);
    expect(data!.delta).toBe(40);
    expect(data!.category).toBe("admin_adjust");
    expect(data!.awarded_by).toBe(szef.id);
  });

  it("przyznaje punkty drużynie bez wskazywania osoby", async () => {
    const teamId = await firstTeamId();
    const szef = await nowyAdmin("kaplan-druzyna");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: -60,
      p_reason: "kara za nocne wycie",
      p_team_id: teamId,
    });

    expect(error).toBeNull();

    const { data } = await admin
      .from("points_ledger")
      .select("user_id, team_id, delta")
      .eq("team_id", teamId)
      .eq("delta", -60)
      .single();

    expect(data!.user_id).toBeNull();
  });

  it("odmawia przyznania bez uzasadnienia", async () => {
    const teamId = await firstTeamId();
    const szef = await nowyAdmin("kaplan-niemowa");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 10,
      p_reason: "  ",
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();
  });

  it("odmawia zerowej zmiany", async () => {
    const teamId = await firstTeamId();
    const szef = await nowyAdmin("kaplan-zero");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 0,
      p_reason: "nic się nie stało",
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();
  });

  it("odmawia przyznania osobie bez drużyny", async () => {
    const sierota = await nowyUzytkownik("bezdomny");
    const szef = await nowyAdmin("kaplan-sierota");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 10,
      p_reason: "za nic konkretnego",
      p_user_id: sierota.id,
    });

    expect(error).not.toBeNull();
  });
});
