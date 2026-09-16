import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  firstTeamId,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Jeden zwykły uczestnik i jeden admin na cały plik, założeni raz w beforeAll.
// Żaden z dziesięciu testów nie bada rozróżnienia między dwiema konkretnymi
// osobami tego samego typu — award_points wywołuje „jakiś admin", odmowę
// sprawdza „jakiś zwykły uczestnik". is_admin() czyta rolę na żywo z profili
// przy każdym wywołaniu, więc jedno logowanie na rolę wystarcza.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let szef: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  uczestnik = await createUser("uczestnik-punkty");
  uczestnikClient = await signIn(uczestnik);
  szef = await createUser("kaplan-punkty");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(uczestnik);
  await deleteUser(szef);
});

afterEach(async () => {
  await admin.from("points_ledger").delete().eq("category", "admin_adjust");
  // Pierwszy test zatwierdza współdzielonego uczestnika do drużyny — reset,
  // żeby kolejne testy zawsze widziały go w domyślnym stanie.
  await admin
    .from("profiles")
    .update({ status: "pending", team_id: null })
    .eq("id", uczestnik.id);
  await posprzataj();
});

describe("przyznawanie punktów", () => {
  it("nie pozwala uczestnikowi przyznać punktów", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(uczestnik, teamId);

    const { error } = await uczestnikClient.rpc("award_points", {
      p_delta: 500,
      p_reason: "bo tak",
      p_user_id: uczestnik.id,
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

    const { error } = await adminClient.rpc("award_points", {
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

    const { error } = await adminClient.rpc("award_points", {
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

    const { error } = await adminClient.rpc("award_points", {
      p_delta: 10,
      p_reason: "  ",
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();
  });

  it("odmawia zerowej zmiany", async () => {
    const teamId = await firstTeamId();

    const { error } = await adminClient.rpc("award_points", {
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

    const { error } = await adminClient.rpc("award_points", {
      p_delta: 2147483647,
      p_reason: "hojnosc bez granic",
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();
  });

  it("odmawia, gdy nie wskazano ani osoby, ani drużyny", async () => {
    const { error } = await adminClient.rpc("award_points", {
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

    const { error } = await adminClient.rpc("award_points", {
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

    const { error } = await adminClient.rpc("award_points", {
      p_delta: 10,
      p_reason: "za nic konkretnego",
      p_user_id: sierota.id,
    });

    expect(error).not.toBeNull();
  });
});
