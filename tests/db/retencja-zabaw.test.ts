import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  admin,
  firstTeamId,
  idZadania,
  ustawJakoZaakceptowany,
  ustawUstawienie,
  sprzatanieUzytkownikow,
  signIn,
  type TestUser,
} from "../helpers/supabase";

// Ten plik kasuje WSZYSTKIE treści z zabaw na bazie testowej — tak działa
// funkcja po terminie. Pliki testów idą po kolei (fileParallelism: false),
// a każdy inny plik zakłada sobie dane sam, więc nikomu nic nie ginie w trakcie.

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();
let ala: TestUser;
let druzyna: string;
const url = process.env.TEST_SUPABASE_URL!;

// Jedno zgłoszenie na pole i drużynę — każde zasianie bierze kolejne pole.
let pole = 0;
async function zasiej() {
  const zadanie = await idZadania(pole++);
  const { data: sub, error } = await admin
    .from("bingo_submissions")
    .insert({ team_id: druzyna, user_id: ala.id, task_id: zadanie, photo_path: `${ala.id}/retencja.jpg` })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("feed_comments").insert({ submission_id: sub!.id, user_id: ala.id, body: "komentarz (retencja)" });
  await admin.from("gossip_categories").insert({ title: "Retencja (test)" });
  await admin.from("points_ledger").insert({ team_id: druzyna, user_id: ala.id, delta: 5, category: "zasiew_testowy" });
}

async function ile(tabela: string): Promise<number> {
  const { count } = await admin.from(tabela).select("*", { count: "exact", head: true });
  return count ?? 0;
}

beforeAll(async () => {
  druzyna = await firstTeamId();
  ala = await nowyUzytkownik("retencja-ala");
  await nowyAdmin("retencja-szef");
  await ustawJakoZaakceptowany(ala, druzyna);
  // Czysty start: resztki po przerwanym przebiegu blokowałyby pola bingo.
  await ustawUstawienie("data_retencji_zabaw", "2020-01-31");
  await admin.rpc("sprzataj_zabawy");
});

afterAll(async () => {
  await ustawUstawienie("data_retencji_zabaw", "2027-01-31");
  await admin.from("sekrety").update({ wartosc: "" }).eq("klucz", "storage_url");
  await posprzataj();
});

describe("retencja treści z zabaw", () => {
  it("przed terminem nic nie znika", async () => {
    await ustawUstawienie("data_retencji_zabaw", "2099-01-31");
    await zasiej();
    const { data } = await admin.rpc("sprzataj_zabawy");
    expect(data).toEqual({ wykonane: false });
    expect(await ile("bingo_submissions")).toBeGreaterThan(0);
  });

  it("po terminie znikają zgłoszenia bingo, komentarze, gossipy i punkty", async () => {
    await ustawUstawienie("data_retencji_zabaw", "2020-01-31");
    await zasiej();
    const { data, error } = await admin.rpc("sprzataj_zabawy");
    expect(error).toBeNull();
    expect((data as { wykonane: boolean }).wykonane).toBe(true);
    for (const t of ["bingo_submissions", "feed_comments", "gossip_categories", "points_ledger", "powiadomienia"]) {
      expect(await ile(t), t).toBe(0);
    }
    // Rzeczy bez danych osobowych zostają.
    expect(await ile("bingo_tasks")).toBe(25);
    expect(await ile("teams")).toBeGreaterThan(0);
  });

  it("pliki kasuje API Storage, gdy podany jest adres projektu", async () => {
    const sciezka = `${ala.id}/retencja-${crypto.randomUUID()}.jpg`;
    const alaClient = await signIn(ala);
    const { error: bladUploadu } = await alaClient.storage
      .from("bingo")
      .upload(sciezka, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), {
        contentType: "image/jpeg",
      });
    expect(bladUploadu).toBeNull();

    await admin.from("sekrety").update({ wartosc: url }).eq("klucz", "storage_url");
    await ustawUstawienie("data_retencji_zabaw", "2020-01-31");
    const { data } = await admin.rpc("sprzataj_zabawy");
    expect((data as { pliki_zlecone: number }).pliki_zlecone).toBeGreaterThan(0);

    // pg_net wysyła po zatwierdzeniu transakcji — czekamy, aż plik zniknie.
    let jest = true;
    for (let i = 0; i < 20 && jest; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const { data: lista } = await admin.storage.from("bingo").list(ala.id);
      jest = (lista ?? []).some((f) => sciezka.endsWith(f.name));
    }
    expect(jest).toBe(false);
  }, 60_000);

  it("uczestnik nie wywoła sprzątania ani kasowania plików", async () => {
    const alaClient = await signIn(ala);
    expect((await alaClient.rpc("sprzataj_zabawy")).error).not.toBeNull();
    expect((await alaClient.rpc("zlec_usuniecie_plikow", { p_bucket: "bingo" })).error).not.toBeNull();
  });
});
