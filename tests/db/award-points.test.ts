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

  it("odmawia zmiany poza rozsądnym zakresem", async () => {
    // Widok team_scores rzutuje sumę na int. Dwa wpisy po INT_MAX wystarczą,
    // żeby odczyt widoku padał na `22003 integer out of range` — i ranking
    // przestaje działać dla wszystkich drużyn naraz, nie tylko dla tej jednej.
    const teamId = await firstTeamId();
    const szef = await nowyAdmin("kaplan-rozmach");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 2147483647,
      p_reason: "hojnosc bez granic",
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();
  });

  it("odmawia, gdy nie wskazano ani osoby, ani drużyny", async () => {
    const szef = await nowyAdmin("kaplan-donikad");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 10,
      p_reason: "w przestrzen",
    });

    expect(error).not.toBeNull();
  });

  it("ignoruje wskazaną drużynę, gdy podano osobę", async () => {
    // Decyzja D2: saldo osoby i saldo drużyny liczą się z jednej tabeli.
    // Rozjazd user_id z team_id rozsypałby oba naraz, więc drużyna musi
    // pochodzić z profilu, nawet jeśli wywołanie podaje inną.
    const { data: druzyny } = await admin
      .from("teams")
      .select("id")
      .order("name")
      .limit(2);
    const [pierwsza, druga] = druzyny as { id: string }[];

    const gracz = await nowyUzytkownik("dwuznaczny");
    await ustawJakoZaakceptowany(gracz, pierwsza.id);
    const szef = await nowyAdmin("kaplan-rozjazd");
    const client = await signIn(szef);

    const { error } = await client.rpc("award_points", {
      p_delta: 15,
      p_reason: "sprzeczne parametry",
      p_user_id: gracz.id,
      p_team_id: druga.id,
    });

    expect(error).toBeNull();

    const { data } = await admin
      .from("points_ledger")
      .select("team_id")
      .eq("user_id", gracz.id)
      .single();

    expect(data!.team_id).toBe(pierwsza.id);
    expect(data!.team_id).not.toBe(druga.id);
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
