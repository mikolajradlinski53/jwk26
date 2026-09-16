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
  // ustawiony, ale FK na profiles jest „on delete set null", nie cascade —
  // skasowanie autora osierociłoby wiersz, a nie usunęło go. Drużyny są zasiane
  // na stałe i współdzielone między plikami testowymi, więc bez tego sprzątania
  // bonus „wiersz-0" zostałby w bazie na zawsze i zafałszował kolejny przebieg
  // (test 6 zobaczyłby wpis, którego sam nie stworzył).
  await admin.from("points_ledger").delete().in("category", ["bingo", "bingo_bonus"]);
  // Zgłoszenia kasujemy jawnie z tego samego powodu co księgę — nie polegamy
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
    // wykonałaby się i padła dopiero na strażniku is_admin() — komunikatem
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
    // jest zasiana na stałe i współdzielona z innymi plikami testowymi — bez
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

  it("zapalenie linii daje bonus raz", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("linia-bingo");

    // Cztery pierwsze pola wiersza 0 zapalone z pominięciem funkcji.
    await zapal(teamId, autor.id, [0, 1, 2, 3]);

    const taskId = await idZadania(4);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(error).toBeNull();

    const { data: bonus } = await admin
      .from("points_ledger")
      .select("user_id, ref_type, ref_id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_linia")
      .eq("ref_id", "wiersz-0");
    expect(bonus).toHaveLength(1);
    expect(bonus![0].user_id).toBeNull();
  });

  it("bonus nie przychodzi drugi raz", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("powtorka-linii-bingo");

    // Cała linia zapalona z pominięciem funkcji — bonus jeszcze nie istnieje,
    // bo nigdy nie przeszedł przez review_bingo.
    await zapal(teamId, autor.id, [0, 1, 2, 3, 4]);

    // Pierwsza akceptacja gdzie indziej (wiersz 1) wykrywa już kompletny
    // wiersz 0 i dopisuje bonus po raz pierwszy.
    const taskA = await idZadania(5);
    const zgloszenieA = await wstawZgloszenie(autor, teamId, taskA);
    const pierwsze = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieA,
      p_approve: true,
    });
    expect(pierwsze.error).toBeNull();

    const { data: poPierwszym } = await admin
      .from("points_ledger")
      .select("id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_linia")
      .eq("ref_id", "wiersz-0");
    expect(poPierwszym).toHaveLength(1);

    // Druga akceptacja, znów w innym polu tej samej linii — wiersz 0 jest
    // wciąż kompletny, więc pętla bonusów go znowu wykryje. Licznik ma
    // zostać na jedynce, bo wpis już istnieje.
    const taskB = await idZadania(6);
    const zgloszenieB = await wstawZgloszenie(autor, teamId, taskB);
    const drugie = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieB,
      p_approve: true,
    });
    expect(drugie.error).toBeNull();

    const { data: poDrugim } = await admin
      .from("points_ledger")
      .select("id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_linia")
      .eq("ref_id", "wiersz-0");
    expect(poDrugim).toHaveLength(1);
  });

  it("przekątna też liczy się jako linia", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("przekatna-bingo");

    await zapal(teamId, autor.id, [0, 6, 12, 18]);

    const taskId = await idZadania(24);
    const zgloszenieId = await wstawZgloszenie(autor, teamId, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(error).toBeNull();

    const { data: bonus } = await admin
      .from("points_ledger")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_linia")
      .eq("ref_id", "przekatna-a");
    expect(bonus).toHaveLength(1);
    expect(bonus![0].user_id).toBeNull();
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
});
