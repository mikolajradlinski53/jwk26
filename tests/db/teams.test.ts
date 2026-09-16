import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  firstTeamId,
  ustawJakoZaakceptowany,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const zalozone: string[] = [];

// Jeden zwykły członek drużyny i jeden admin na cały plik. Żaden z trzech
// testów nie bada rozróżnienia między dwiema konkretnymi osobami — tylko to,
// co wolno roli. is_admin()/is_approved() czytają rolę i status na żywo z
// profili, więc zatwierdzenie kluczem serwisowym w beforeAll wystarczy raz.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let szef: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  const teamId = await firstTeamId();
  uczestnik = await createUser("uczestnik-druzyny");
  await ustawJakoZaakceptowany(uczestnik, teamId);
  uczestnikClient = await signIn(uczestnik);

  szef = await createUser("kaplan-druzyn");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(uczestnik);
  await deleteUser(szef);
});

afterEach(async () => {
  if (zalozone.length) {
    await admin.from("teams").delete().in("id", zalozone.splice(0));
  }
});

describe("drużyny", () => {
  it("nie pozwala uczestnikowi zmienić nazwy drużyny", async () => {
    const teamId = await firstTeamId();

    const { data } = await uczestnikClient
      .from("teams")
      .update({ name: "Loża Przejęta" })
      .eq("id", teamId)
      .select();

    // Brak polityki UPDATE dla uczestnika nie daje błędu — daje pustą listę
    // zmienionych wierszy.
    expect(data).toEqual([]);

    const { data: kontrola } = await admin
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .single();
    expect(kontrola!.name).not.toBe("Loża Przejęta");
  });

  it("nie pozwala uczestnikowi założyć drużyny", async () => {
    const { error } = await uczestnikClient
      .from("teams")
      .insert({ name: "Sekta Prywatna", slug: "prywatna" });

    expect(error).not.toBeNull();
  });

  it("pozwala adminowi założyć drużynę", async () => {
    const { data, error } = await adminClient
      .from("teams")
      .insert({ name: "Zakon Testowy", slug: `test-${Date.now()}` })
      .select("id")
      .single();

    expect(error).toBeNull();
    if (data) zalozone.push(data.id as string);
  });
});
