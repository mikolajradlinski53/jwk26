import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  signIn,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
  firstTeamId,
  idZadania,
  zgloszenieBingoDla,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();
afterEach(posprzataj);

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

describe("polityki RLS: bingo", () => {
  it("zaakceptowany widzi zadania", async () => {
    const user = await nowyUzytkownik("widz-zadan");
    await ustawJakoZaakceptowany(user);
    const client = await signIn(user);

    const { data, error } = await client.from("bingo_tasks").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(25);
  });

  it("oczekujący nie widzi zadań", async () => {
    // Świeży użytkownik jest 'pending' domyślnie — bez żadnej dodatkowej akcji.
    const user = await nowyUzytkownik("czekajacy-na-plansze");
    const client = await signIn(user);

    const { data, error } = await client.from("bingo_tasks").select("id");

    // RLS przy odczycie nie zwraca błędu, tylko pusty zbiór.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("uczestnik składa zgłoszenie dla własnej drużyny", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("zglaszajacy-bingo");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);
    const taskId = await idZadania(0);

    const { error } = await client
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(user, teamId, taskId));

    expect(error).toBeNull();
  });

  it("nie złoży zgłoszenia w cudzym imieniu", async () => {
    const teamId = await firstTeamId();
    const ofiara = await nowyUzytkownik("ofiara-bingo");
    const podszywacz = await nowyUzytkownik("podszywacz-bingo");
    await ustawJakoZaakceptowany(podszywacz, teamId);
    const client = await signIn(podszywacz);
    const taskId = await idZadania(1);

    const { error } = await client.from("bingo_submissions").insert({
      ...zgloszenieBingoDla(ofiara, teamId, taskId),
      // Własna ścieżka, żeby jedynym naruszeniem był user_id. Inaczej test
      // przechodzi także po usunięciu warunku, który rzekomo pilnuje.
      photo_path: `${podszywacz.id}/zdjecie.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie złoży zgłoszenia dla cudzej drużyny", async () => {
    const wlasnaDruzyna = await firstTeamId();
    const cudzaDruzyna = await innaDruzyna(wlasnaDruzyna);
    const user = await nowyUzytkownik("chytry-bingo");
    await ustawJakoZaakceptowany(user, wlasnaDruzyna);
    const client = await signIn(user);
    const taskId = await idZadania(2);

    const { error } = await client
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(user, cudzaDruzyna, taskId));

    expect(error).not.toBeNull();
  });

  it("nie wskaże cudzego pliku", async () => {
    // Bez warunku na photo_path w polityce INSERT uczestnik podpiąłby pod
    // swoje zgłoszenie ścieżkę do cudzego zdjęcia i zobaczyłby je w feedzie.
    const teamId = await firstTeamId();
    const wlasciciel = await nowyUzytkownik("wlasciciel-zdjecia-bingo");
    const zerkacz = await nowyUzytkownik("zerkacz-bingo");
    await ustawJakoZaakceptowany(zerkacz, teamId);
    const client = await signIn(zerkacz);
    const taskId = await idZadania(3);

    const { error } = await client.from("bingo_submissions").insert({
      ...zgloszenieBingoDla(zerkacz, teamId, taskId),
      photo_path: `${wlasciciel.id}/zdjecie.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie złoży drugiego zgłoszenia do tego samego pola", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("zalewacz-bingo");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);
    const taskId = await idZadania(4);
    const zgloszenie = zgloszenieBingoDla(user, teamId, taskId);

    const pierwsze = await client.from("bingo_submissions").insert(zgloszenie);
    expect(pierwsze.error).toBeNull();

    // Unikalny indeks częściowy na (team_id, task_id) where status <> 'rejected'.
    const drugie = await client.from("bingo_submissions").insert(zgloszenie);
    expect(drugie.error).not.toBeNull();
  });

  it("odrzucenie zwalnia pole", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("druga-szansa-bingo");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);
    const taskId = await idZadania(5);
    const zgloszenie = zgloszenieBingoDla(user, teamId, taskId);

    const { data: pierwsze, error: bladZapisu } = await client
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
    const { error } = await client.from("bingo_submissions").insert(zgloszenie);
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
    const user = await nowyUzytkownik("wycofujacy-bingo");
    await ustawJakoZaakceptowany(user, teamId);
    const client = await signIn(user);
    const taskId = await idZadania(6);

    const { data: wiersz, error: bladZapisu } = await client
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(user, teamId, taskId))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: skasowane } = await client
      .from("bingo_submissions")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(skasowane).toHaveLength(1);
  });

  it("nie wycofa cudzego", async () => {
    const teamId = await firstTeamId();
    const autor = await nowyUzytkownik("autor-bingo");
    const ciekawski = await nowyUzytkownik("ciekawski-bingo");
    await ustawJakoZaakceptowany(ciekawski, teamId);
    const taskId = await idZadania(7);

    // Wstawione kluczem serwisowym — bez tego test byłby zielony także wtedy,
    // gdyby wiersz w ogóle nie powstał.
    const { data: wiersz, error: bladZapisu } = await admin
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(autor, teamId, taskId))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const client = await signIn(ciekawski);
    const { data: poKasowaniu } = await client
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
    const user = await nowyUzytkownik("zaakceptowany-bingo");
    await ustawJakoZaakceptowany(user, teamId);
    const taskId = await idZadania(8);

    const { data: wiersz, error: bladZapisu } = await admin
      .from("bingo_submissions")
      .insert({
        ...zgloszenieBingoDla(user, teamId, taskId),
        status: "approved",
      })
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const client = await signIn(user);
    const { data: poKasowaniu } = await client
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
    const user = await nowyUzytkownik("uparty-bingo");
    await ustawJakoZaakceptowany(user, teamId);
    const taskId = await idZadania(9);

    const { data: wiersz, error: bladZapisu } = await admin
      .from("bingo_submissions")
      .insert(zgloszenieBingoDla(user, teamId, taskId))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Brak polityki UPDATE na bingo_submissions: status zmienia wyłącznie
    // review_bingo. W PostgREST odbicie przez RLS nie zwraca błędu, tylko
    // pustą listę zmienionych wierszy.
    const client = await signIn(user);
    const { data: poZmianie } = await client
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
