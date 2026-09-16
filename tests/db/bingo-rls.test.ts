import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
  firstTeamId,
  idZadania,
  zgloszenieBingoDla,
  createUser,
  deleteUser,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

/**
 * Druga drużyna, różna od tej podanej — potrzebna wyłącznie do testu, który
 * sprawdza, że nie da się złożyć zgłoszenia dla cudzej drużyny. Drużyny są
 * zasiane na stałe (migracja 0001) i współdzielone między plikami testowymi,
 * więc tylko czytamy, nigdy nie modyfikujemy.
 */
async function innaDruzyna(niz: string): Promise<string> {
  const { data, error } = await admin
    .from("teams")
    .select("id")
    .neq("id", niz)
    .limit(1)
    .single();
  if (error) throw error;
  return data.id as string;
}

// Jeden uczestnik na cały plik, zalogowany raz w beforeAll: dwanaście testów
// bada politykę RLS z punktu widzenia „jakiegoś" (nie)zaakceptowanego członka
// drużyny, żaden nie rozróżnia dwóch konkretnych osób. is_approved() czyta
// status z profili na żywo przy każdym wywołaniu, więc zatwierdzenie albo
// cofnięcie statusu kluczem serwisowym w afterEach widać w sesji od razu, bez
// ponownego logowania.
let czlonek: TestUser;
let czlonekClient: SupabaseClient;

beforeAll(async () => {
  czlonek = await createUser("uczestnik-bingo-rls");
  czlonekClient = await signIn(czlonek);
});

afterAll(async () => {
  await deleteUser(czlonek);
});

afterEach(async () => {
  await admin.from("bingo_submissions").delete().eq("user_id", czlonek.id);
  // Reset do stanu domyślnego (pending, bez drużyny) — kilka testów zatwierdza
  // tego uczestnika, kolejny test ma zawsze zaczynać od świeżego konta.
  await admin
    .from("profiles")
    .update({ status: "pending", team_id: null })
    .eq("id", czlonek.id);
  await posprzataj();
});

describe("polityki RLS: bingo", () => {
  it("zaakceptowany widzi zadania", async () => {
    await ustawJakoZaakceptowany(czlonek);

    const { data, error } = await czlonekClient.from("bingo_tasks").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(25);
  });

  it("oczekujący nie widzi zadań", async () => {
    // Brak tu jawnego ustawienia statusu, bo 'pending' to stan domyślny świeżego
    // konta — a afterEach i tak przywraca go po każdym teście. Test przechodzi
    // więc również uruchomiony samotnie, przez `-t`; nie zależy od tego, że coś
    // przed nim poszło pierwsze. Sprawdzone.
    const { data, error } = await czlonekClient.from("bingo_tasks").select("id");

    // RLS przy odczycie nie zwraca błędu, tylko pusty zbiór.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("uczestnik składa zgłoszenie dla własnej drużyny", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(0);

    const { error } = await czlonekClient
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(czlonek, teamId, taskId));

    expect(error).toBeNull();
  });

  it("nie złoży zgłoszenia w cudzym imieniu", async () => {
    const teamId = await firstTeamId();
    const ofiara = await nowyUzytkownik("ofiara-bingo");
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(1);

    const { error } = await czlonekClient.from("bingo_submissions").insert({
      ...zgloszenieBingoDla(ofiara, teamId, taskId),
      // Własna ścieżka, żeby jedynym naruszeniem był user_id. Inaczej test
      // przechodzi także po usunięciu warunku, który rzekomo pilnuje.
      photo_path: `${czlonek.id}/zdjecie.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie złoży zgłoszenia dla cudzej drużyny", async () => {
    const wlasnaDruzyna = await firstTeamId();
    const cudzaDruzyna = await innaDruzyna(wlasnaDruzyna);
    await ustawJakoZaakceptowany(czlonek, wlasnaDruzyna);
    const taskId = await idZadania(2);

    const { error } = await czlonekClient
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(czlonek, cudzaDruzyna, taskId));

    expect(error).not.toBeNull();
  });

  it("nie wskaże cudzego pliku", async () => {
    // Bez warunku na photo_path w polityce INSERT uczestnik podpiąłby pod
    // swoje zgłoszenie ścieżkę do cudzego zdjęcia i zobaczyłby je w feedzie.
    const teamId = await firstTeamId();
    const wlasciciel = await nowyUzytkownik("wlasciciel-zdjecia-bingo");
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(3);

    const { error } = await czlonekClient.from("bingo_submissions").insert({
      ...zgloszenieBingoDla(czlonek, teamId, taskId),
      photo_path: `${wlasciciel.id}/zdjecie.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie złoży drugiego zgłoszenia do tego samego pola", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(4);
    const zgloszenie = zgloszenieBingoDla(czlonek, teamId, taskId);

    const pierwsze = await czlonekClient.from("bingo_submissions").insert(zgloszenie);
    expect(pierwsze.error).toBeNull();

    // Unikalny indeks częściowy na (team_id, task_id) where status <> 'rejected'.
    const drugie = await czlonekClient.from("bingo_submissions").insert(zgloszenie);
    expect(drugie.error).not.toBeNull();
  });

  it("odrzucenie zwalnia pole", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(5);
    const zgloszenie = zgloszenieBingoDla(czlonek, teamId, taskId);

    const { data: pierwsze, error: bladZapisu } = await czlonekClient
      .from("bingo_submissions")
      .insert(zgloszenie)
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Odrzucenie kluczem serwisowym — samą funkcję review_bingo bada inny test.
    await admin
      .from("bingo_submissions")
      .update({ status: "rejected" })
      .eq("id", pierwsze!.id);

    // Indeks jest częściowy (where status <> 'rejected') — sprawdzamy dokładnie
    // ten warunek, nie samą unikalność (którą już potwierdził test powyżej).
    // Gdyby zapisano go bez tego warunku, pole raz zajęte zostałoby zablokowane
    // na stałe nawet po odrzuceniu zgłoszenia.
    const { error } = await czlonekClient.from("bingo_submissions").insert(zgloszenie);
    expect(error).toBeNull();

    const { data: wszystkie } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("team_id", teamId)
      .eq("task_id", taskId);
    expect(wszystkie).toHaveLength(2);
  });

  it("autor wycofuje własne oczekujące", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(6);

    const { data: wiersz, error: bladZapisu } = await czlonekClient
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(czlonek, teamId, taskId))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: skasowane } = await czlonekClient
      .from("bingo_submissions")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(skasowane).toHaveLength(1);
  });

  it("nie wycofa cudzego", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("autor-bingo");
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(7);

    // Wstawione kluczem serwisowym — bez tego test byłby zielony także wtedy,
    // gdyby wiersz w ogóle nie powstał.
    const { data: wiersz, error: bladZapisu } = await admin
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(autor, teamId, taskId))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: poKasowaniu } = await czlonekClient
      .from("bingo_submissions")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin
      .from("bingo_submissions")
      .select("id")
      .eq("id", wiersz!.id);
    expect(kontrola).toHaveLength(1);
  });

  it("nie wycofa zaakceptowanego", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(8);

    const { data: wiersz, error: bladZapisu } = await admin
      .from("bingo_submissions")
      .insert({
        ...zgloszenieBingoDla(czlonek, teamId, taskId),
        status: "approved",
      })
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: poKasowaniu } = await czlonekClient
      .from("bingo_submissions")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin
      .from("bingo_submissions")
      .select("id")
      .eq("id", wiersz!.id);
    expect(kontrola).toHaveLength(1);
  });

  it("nikt nie zmieni statusu zwykłym UPDATE-em", async () => {
    const teamId = await firstTeamId();
    await ustawJakoZaakceptowany(czlonek, teamId);
    const taskId = await idZadania(9);

    const { data: wiersz, error: bladZapisu } = await admin
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(czlonek, teamId, taskId))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Brak polityki UPDATE na bingo_submissions: status zmienia wyłącznie
    // review_bingo. W PostgREST odbicie przez RLS nie zwraca błędu, tylko
    // pustą listę zmienionych wierszy.
    const { data: poZmianie } = await czlonekClient
      .from("bingo_submissions")
      .update({ status: "approved" })
      .eq("id", wiersz!.id)
      .select();

    expect(poZmianie).toEqual([]);

    const { data: kontrola } = await admin
      .from("bingo_submissions")
      .select("status")
      .eq("id", wiersz!.id)
      .single();
    expect(kontrola!.status).toBe("pending");
  });
});
