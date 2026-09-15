import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  signIn,
  anonimowy,
  firstTeamId,
  sprzatanieUzytkownikow,
  zgloszenieDla,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();
afterEach(posprzataj);

/** Zakłada czekające zgłoszenie i zwraca jego identyfikator. */
async function zlozZgloszenie(user: TestUser): Promise<string> {
  const { data, error } = await admin
    .from("registrations")
    .insert(zgloszenieDla(user))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("rozpatrywanie zgłoszeń", () => {
  it("nie pozwala uczestnikowi zaakceptować samego siebie", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("samozwaniec");
    const zgloszenieId = await zlozZgloszenie(user);
    const client = await signIn(user);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("nie pozwala wywołać funkcji bez zalogowania", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("bez-sesji");
    const zgloszenieId = await zlozZgloszenie(petent);

    const { error } = await anonimowy().rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();

    // Rozróżnienie jest tu istotne. Gdyby grant dla roli anon został, funkcja
    // wykonałaby się i padła dopiero na strażniku is_admin() — komunikatem
    // o adminie. Cokolwiek innego dowodzi, że `revoke ... from anon` zadziałał:
    // PostgREST zgłasza brak uprawnień albo w ogóle nie znajduje funkcji,
    // zależnie od wersji.
    expect(error!.message).not.toMatch(/admin/i);

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", petent.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("akceptuje zgłoszenie i przypisuje drużynę", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("petent");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });

    expect(error).toBeNull();

    const { data: profil } = await admin
      .from("profiles")
      .select("status, team_id, display_name")
      .eq("id", petent.id)
      .single();
    expect(profil!.status).toBe("approved");
    expect(profil!.team_id).toBe(teamId);
    expect(profil!.display_name).toBe("Brat Testowy");

    const { data: zgl } = await admin
      .from("registrations")
      .select("status, reviewed_by, reviewed_at")
      .eq("id", zgloszenieId)
      .single();
    expect(zgl!.status).toBe("approved");
    expect(zgl!.reviewed_by).toBe(szef.id);
    expect(zgl!.reviewed_at).not.toBeNull();
  });

  it("odmawia akceptacji bez wskazania drużyny", async () => {
    const petent = await nowyUzytkownik("bezdruzyny");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan2");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", petent.id)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("odmawia rozpatrzenia bez decyzji", async () => {
    // Zabezpieczenie z migracji hartowania: przed nim `p_approve = null`
    // przechodziło oba warunki i po cichu odrzucało zgłoszenie, bo `case when
    // null` zachowuje się jak fałsz. Literówka w panelu kosztowałaby kogoś wyjazd.
    const petent = await nowyUzytkownik("niezdecydowany");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan5");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: null,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("registrations")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("odrzuca zgłoszenie razem z notatką", async () => {
    const petent = await nowyUzytkownik("odrzucony");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan3");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: false,
      p_note: "Zdjęcie nieczytelne",
    });

    expect(error).toBeNull();

    const { data: zgl } = await admin
      .from("registrations")
      .select("status, review_note, reviewed_by, reviewed_at")
      .eq("id", zgloszenieId)
      .single();
    expect(zgl!.status).toBe("rejected");
    expect(zgl!.review_note).toBe("Zdjęcie nieczytelne");
    expect(zgl!.reviewed_by).toBe(szef.id);
    expect(zgl!.reviewed_at).not.toBeNull();

    const { data: profil } = await admin
      .from("profiles")
      .select("status, team_id")
      .eq("id", petent.id)
      .single();
    expect(profil!.status).toBe("rejected");
    expect(profil!.team_id).toBeNull();
  });

  it("nie pozwala rozpatrzyć tego samego zgłoszenia dwa razy", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("dwukrotny");
    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan4");
    const client = await signIn(szef);

    const pierwsze = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });
    expect(pierwsze.error).toBeNull();

    const drugie = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: false,
      p_note: "Rozmyśliłem się",
    });
    expect(drugie.error).not.toBeNull();

    const { data } = await admin
      .from("registrations")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("approved");
  });

  it("nie nadpisuje nazwy, którą uczestnik już sobie ustawił", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("nazwany");

    // Granty kolumnowe z migracji 0001 pozwalają zmienić własne display_name.
    const jego = await signIn(petent);
    const { error: bladNazwy } = await jego
      .from("profiles")
      .update({ display_name: "Siostra Zofia" })
      .eq("id", petent.id);
    expect(bladNazwy).toBeNull();

    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan6");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });
    expect(error).toBeNull();

    // Gdyby coalesce(display_name, v_full_name) zamienić na samo v_full_name,
    // ta asercja padnie. Test startujący z pustym display_name niczego by nie
    // zauważył, bo obie wersje dałyby ten sam wynik.
    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", petent.id)
      .single();
    expect(data!.display_name).toBe("Siostra Zofia");
  });

  it("zostawia drużynę nietkniętą przy odrzuceniu", async () => {
    const teamId = await firstTeamId();
    const petent = await nowyUzytkownik("bylec");

    // Ktoś, kto był już w drużynie i składa kolejne zgłoszenie. Odrzucenie nie
    // ma prawa wypisać go z drużyny — stąd `else team_id` w funkcji.
    await ustawJakoZaakceptowany(petent, teamId);
    await admin.from("profiles").update({ status: "pending" }).eq("id", petent.id);

    const zgloszenieId = await zlozZgloszenie(petent);
    const szef = await nowyAdmin("kaplan7");
    const client = await signIn(szef);

    const { error } = await client.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: false,
      p_note: "Brak wplaty",
    });
    expect(error).toBeNull();

    // Ta asercja rozróżnia „zachowaj istniejącą" od „zawsze wyzeruj", czego
    // test startujący z team_id = null nie potrafi.
    const { data } = await admin
      .from("profiles")
      .select("status, team_id")
      .eq("id", petent.id)
      .single();
    expect(data!.status).toBe("rejected");
    expect(data!.team_id).toBe(teamId);
  });
});
