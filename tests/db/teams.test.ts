import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  signIn,
  firstTeamId,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();
const zalozone: string[] = [];

afterEach(async () => {
  if (zalozone.length) {
    await admin.from("teams").delete().in("id", zalozone.splice(0));
  }
  await posprzataj();
});

describe("drużyny", () => {
  it("nie pozwala uczestnikowi zmienić nazwy drużyny", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("przemianowywacz");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);

    const { data } = await client
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
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("zalozyciel");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);

    const { error } = await client
      .from("teams")
      .insert({ name: "Sekta Prywatna", slug: "prywatna" });

    expect(error).not.toBeNull();
  });

  it("pozwala adminowi założyć drużynę", async () => {
    const szef = await nowyAdmin("kaplan-druzyn");
    const client = await signIn(szef);

    const { data, error } = await client
      .from("teams")
      .insert({ name: "Zakon Testowy", slug: `test-${Date.now()}` })
      .select("id")
      .single();

    expect(error).toBeNull();
    if (data) zalozone.push(data.id as string);
  });
});
