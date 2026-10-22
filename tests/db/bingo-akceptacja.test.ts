import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  anonimowy,
  firstTeamId,
  sprzatanieUzytkownikow,
  createUser,
  deleteUser,
  makeAdmin,
  idZadania,
  zgloszenieBingoDla,
  zapal,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Jeden admin na cały plik, zalogowany raz w beforeAll: dziesięć testów, każdy
// wywołuje review_bingo, a projekt testowy dopuszcza tylko trzydzieści logowań
// na pięć minut. Osobne logowanie w każdym teście zjadłoby zapas na nic.
let szef: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  szef = await createUser("kaplan-bingo");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(szef);
});

afterEach(async () => {
  // Bonusy mają user_id = null (są zasługą drużyny, nie osoby), więc kaskada
  // po auth.users ich nie dotknie. Wpisy za pojedyncze zadania mają user_id
  // ustawiony, ale FK na profiles jest „on delete set null", nie cascade -
  // skasowanie autora osierociłoby wiersz, a nie usunęło go. Drużyny są zasiane
  // na stałe i współdzielone między plikami testowymi, więc bez tego sprzątania
  // bonus „wiersz-0" zostałby w bazie na zawsze i zafałszował kolejny przebieg
  // (test 6 zobaczyłby wpis, którego sam nie stworzył).
  await admin.from("points_ledger").delete().in("category", ["bingo", "bingo_bonus"]);
  // Zgłoszenia kasujemy jawnie z tego samego powodu co księgę - nie polegamy
  // na kaskadzie z auth.users, choć akurat tu by zadziałała. Filtr dopasowuje
  // każdy wiersz: id jest kluczem głównym typu uuid, więc nigdy nie jest null.
  await admin.from("bingo_submissions").delete().not("id", "is", null);
  await posprzataj();
});

/** Wstawia oczekujące zgłoszenie kluczem serwisowym i zwraca jego id. */
async function wstawZgloszenie(
  user: TestUser,
  teamId: string,
  taskId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("bingo_submissions")
    .insert(zgloszenieBingoDla(user, teamId, taskId))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("akceptacja zgłoszeń bingo i bonusy", () => {
  it("uczestnik nie rozpatrzy zgłoszenia", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("petent-bingo");
    const taskId = await idZadania(0);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);
    const client = await signIn(autor);

    const { error } = await client.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("niezalogowany nie wywoła funkcji", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("bez-sesji-bingo");
    const taskId = await idZadania(1);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await anonimowy().rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });

    expect(error).not.toBeNull();

    // Rozróżnienie jest tu istotne: gdyby grant dla roli anon został, funkcja
    // wykonałaby się i padła dopiero na strażniku is_admin() - komunikatem
    // o adminie. Cokolwiek innego dowodzi, że `revoke ... from anon` zadziałał.
    expect(error!.message).not.toMatch(/admin/i);

    const { data } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("admin akceptuje: pole zapalone, punkty u autora", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("akceptowany-bingo");
    const taskId = await idZadania(2);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(error).toBeNull();

    const { data: zgl } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(zgl!.status).toBe("approved");

    const { data: zadanie } = await admin
      .from("bingo_tasks")
      .select("points")
      .eq("id", taskId)
      .single();

    const { data: wpisy } = await admin
      .from("points_ledger")
      .select("user_id, delta, ref_type, ref_id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_zadanie");
    expect(wpisy).toHaveLength(1);
    expect(wpisy![0].user_id).toBe(autor.id);
    expect(wpisy![0].delta).toBe(zadanie!.points);
    expect(wpisy![0].ref_id).toBe(zgloszenieId);
  });

  it("admin odrzuca z notatką", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("odrzucony-bingo");
    const taskId = await idZadania(3);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: false,
      p_note: "Zdjęcie nie pokazuje zadania",
    });
    expect(error).toBeNull();

    const { data: zgl } = await admin
      .from("bingo_submissions")
      .select("status, review_note")
      .eq("id", zgloszenieId)
      .single();
    expect(zgl!.status).toBe("rejected");
    expect(zgl!.review_note).toBe("Zdjęcie nie pokazuje zadania");

    // Filtr po ref_type jest tu istotny, choć wygląda na nadmiarowy. Drużyna
    // jest zasiana na stałe i współdzielona z innymi plikami testowymi - bez
    // tego filtra jeden przerwany przebieg `award-points.test.ts` zostawiłby
    // w księdze wiersz kategorii `admin_adjust`, a ten test padłby przy
    // następnym, zupełnie czystym uruchomieniu. Sprawdzone: pada.
    const { data: wpisy } = await admin
      .from("points_ledger")
      .select("id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_zadanie");
    expect(wpisy).toEqual([]);
  });

  /** Akceptuje kluczem admina zgłoszenie na wskazane pole i zwraca błąd RPC. */
  async function zaakceptujPole(autor: TestUser, teamId: string, pozycja: number) {
    const zgloszenieId = await wstawZgloszenie(autor, teamId, await idZadania(pozycja));
    const { error } = await adminClient.rpc("review_bingo", { p_submission_id: zgloszenieId, p_approve: true });
    return error;
  }

  async function wygrane() {
    const { data } = await admin.from("points_ledger").select("team_id, user_id, delta").eq("ref_type", "bingo_wygrana");
    return data ?? [];
  }

  async function druzyny(): Promise<{ jawna: string[]; ukryta: string | null }> {
    const { data } = await admin.from("teams").select("id, ukryta").order("name");
    return {
      jawna: (data ?? []).filter((t) => !t.ukryta).map((t) => t.id as string),
      ukryta: ((data ?? []).find((t) => t.ukryta)?.id as string | undefined) ?? null,
    };
  }

  it("dwie linie to jeszcze nie wygrana", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("dwie-linie-bingo");
    await zapal(teamId, autor.id, [0, 1, 2, 3, 4, 5, 6, 7, 8]);

    expect(await zaakceptujPole(autor, teamId, 9)).toBeNull();
    expect(await wygrane()).toEqual([]);
  });

  it("trzy linie (z polem darmowym) dają wygraną pierwszej drużynie, raz", async () => {
    const { jawna } = await druzyny();
    const [pierwsza, druga] = jawna;
    const autor = await nowyUzytkownik("trzy-linie-bingo");
    // Wiersze 0 i 1 pełne, wiersz 2 bez pola 14 - środek (12) jest darmowy.
    await zapal(pierwsza, autor.id, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
    expect(await zaakceptujPole(autor, pierwsza, 14)).toBeNull();

    const poPierwszej = await wygrane();
    expect(poPierwszej).toHaveLength(1);
    expect(poPierwszej[0].team_id).toBe(pierwsza);
    expect(poPierwszej[0].user_id).toBeNull();
    const { data: ustawienie } = await admin.from("app_settings").select("value").eq("key", "bingo_bonus_wygrana").single();
    expect(poPierwszej[0].delta).toBe(Number(ustawienie!.value));

    // Druga drużyna z trzema liniami już nic nie dostaje.
    await zapal(druga, autor.id, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
    expect(await zaakceptujPole(autor, druga, 14)).toBeNull();
    expect(await wygrane()).toHaveLength(1);
  });

  it("przekątna nie liczy się do wygranej", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("przekatna-bingo");
    // Dwa wiersze + przekątna 0-6-12-18-24: według starych zasad trzy linie.
    await zapal(teamId, autor.id, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 18]);

    expect(await zaakceptujPole(autor, teamId, 24)).toBeNull();
    expect(await wygrane()).toEqual([]);
  });

  it("Kadra (drużyna ukryta) nie zgarnia wygranej", async () => {
    const { ukryta } = await druzyny();
    if (!ukryta) return;
    const autor = await nowyUzytkownik("kadra-bingo");
    await zapal(ukryta, autor.id, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);

    expect(await zaakceptujPole(autor, ukryta, 14)).toBeNull();
    expect(await wygrane()).toEqual([]);
  });

  it("na pole darmowe nie da się wysłać zgłoszenia", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("darmowe-bingo");
    const { error } = await admin
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(autor, teamId, await idZadania(12)));
    expect(error?.message).toMatch(/POLE_DARMOWE/);
  });

  it("pełna plansza daje bonus planszy", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("plansza-bingo");

    const wszystkie = Array.from({ length: 25 }, (_, i) => i);
    await zapal(teamId, autor.id, wszystkie.filter((p) => p !== 24));

    const taskId = await idZadania(24);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(error).toBeNull();

    const { data: bonus } = await admin
      .from("points_ledger")
      .select("id, user_id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_plansza");
    expect(bonus).toHaveLength(1);
    expect(bonus![0].user_id).toBeNull();
    const { data: ustawienie } = await admin.from("app_settings").select("value").eq("key", "bingo_bonus_plansza").single();
    expect(Number(ustawienie!.value)).toBe(200);
  });

  it("rozpatrzone zgłoszenie nie da się rozpatrzyć drugi raz", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("dwukrotny-bingo");
    const taskId = await idZadania(7);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const pierwsze = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(pierwsze.error).toBeNull();

    const drugie = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: false,
      p_note: "Rozmyśliłem się",
    });
    expect(drugie.error).not.toBeNull();

    const { data } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("approved");
  });

  it("brak decyzji jest odrzucany", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("niezdecydowany-bingo");
    const taskId = await idZadania(8);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: null,
    });
    expect(error).not.toBeNull();

    const { data } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("id", zgloszenieId)
      .single();
    expect(data!.status).toBe("pending");
  });

  it("odrzucenie wysyła autorowi powiadomienie z powodem", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("odrzucony-bingo");
    await ustawJakoZaakceptowany(autor, teamId);
    const taskId = await idZadania(1);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: false,
      p_note: "Na zdjęciu nie widać całej drużyny",
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("powiadomienia")
      .select("id, kanal, adresat, adresat_id, tytul, body")
      .eq("ref_type", "bingo")
      .eq("ref_id", zgloszenieId);
    await admin.from("powiadomienia").delete().in("id", (data ?? []).map((p) => p.id));
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ kanal: "push", adresat: "user", adresat_id: autor.id, tytul: "Pole bingo odrzucone" });
    expect(data![0].body).toMatch(/Na zdjęciu nie widać całej drużyny/);

    // Uczestnik z tej drużyny widzi odrzucone zgłoszenie razem z powodem -
    // z tego plansza robi pole „odrzucone”.
    const { data: widziane } = await (await signIn(autor))
      .from("bingo_submissions")
      .select("status, review_note")
      .eq("id", zgloszenieId)
      .single();
    expect(widziane).toEqual({ status: "rejected", review_note: "Na zdjęciu nie widać całej drużyny" });
  });
});
