import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  firstTeamId,
  sprzatanieUzytkownikow,
  zgloszenieDla,
  ustawJakoZaakceptowany,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Jeden zwykły uczestnik i jeden admin na cały plik, założeni raz w beforeAll:
// dziewięć testów, część woła review_registration jako „jakiś admin", część
// tylko sprawdza, że „jakiś zwykły uczestnik" nie ma do tego prawa.
// is_admin()/is_approved() czytają rolę i status na żywo z profili przy
// każdym wywołaniu, więc zmiana kluczem serwisowym w afterEach jest widoczna
// w sesji od razu, bez ponownego logowania.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let szef: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  uczestnik = await createUser("uczestnik-rozpatrzenie");
  uczestnikClient = await signIn(uczestnik);
  szef = await createUser("kaplan-rozpatrzenie");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(uczestnik);
  await deleteUser(szef);
});

afterEach(async () => {
  // Dwa testy zostawiają trwały ślad na współdzielonym uczestniku: zgłoszenie
  // i zmienioną nazwę wyświetlaną po zatwierdzeniu. Reset, żeby kolejny test
  // zawsze zaczynał od domyślnego stanu (pending, bez drużyny, bez nazwy).
  await admin.from("registrations").delete().eq("user_id", uczestnik.id);
  await admin
    .from("profiles")
    .update({ status: "pending", team_id: null, display_name: null })
    .eq("id", uczestnik.id);
  await posprzataj();
});

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
    const zgloszenieId = await zlozZgloszenie(uczestnik);

    const { error } = await uczestnikClient.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("status")
      .eq("id", uczestnik.id)
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

    const { error } = await adminClient.rpc("review_registration", {
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

    const { error } = await adminClient.rpc("review_registration", {
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

    const { error } = await adminClient.rpc("review_registration", {
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

    const { error } = await adminClient.rpc("review_registration", {
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

    const pierwsze = await adminClient.rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: true,
      p_team_id: teamId,
    });
    expect(pierwsze.error).toBeNull();

    const drugie = await adminClient.rpc("review_registration", {
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

    // Granty kolumnowe z migracji 0001 pozwalają zmienić własne display_name.
    const { error: bladNazwy } = await uczestnikClient
      .from("profiles")
      .update({ display_name: "Siostra Zofia" })
      .eq("id", uczestnik.id);
    expect(bladNazwy).toBeNull();

    const zgloszenieId = await zlozZgloszenie(uczestnik);

    const { error } = await adminClient.rpc("review_registration", {
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
      .eq("id", uczestnik.id)
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

    const { error } = await adminClient.rpc("review_registration", {
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
