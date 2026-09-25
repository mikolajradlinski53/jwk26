import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  idDruzyn,
  idZadania,
  zgloszenieBingoDla,
  zapal,
  sprzatnijSklepik,
  sprzatanieUzytkownikow,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

let szef: TestUser;
let adminClient: SupabaseClient;
let druzyna: string;

beforeAll(async () => {
  druzyna = (await idDruzyn())[0];
  szef = await createUser("kaplan-blogo");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(szef);
});

afterEach(async () => {
  await admin.from("points_ledger").delete().in("category", ["bingo", "bingo_bonus"]);
  await admin.from("bingo_submissions").delete().not("id", "is", null);
  await sprzatnijSklepik();
  await posprzataj();
});

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

/** Wstawia drużynie gotowe błogosławieństwo, pomijając zakup. */
async function dajBlogoslawienstwo(
  teamId: string,
  opcje: { godziny?: number | null; mnoznik?: number; zuzyte?: boolean } = {},
): Promise<string> {
  const godziny = opcje.godziny === undefined ? 3 : opcje.godziny;
  const { data, error } = await admin
    .from("active_effects")
    .insert({
      scope: "team",
      subject_id: teamId,
      effect_key: "blogoslawienstwo",
      effect_value: opcje.mnoznik ?? 2,
      expires_at:
        godziny === null
          ? null
          : new Date(Date.now() + godziny * 3_600_000).toISOString(),
      consumed_at: opcje.zuzyte ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("błogosławieństwo", () => {
  it("podwaja punkty za zadanie i zużywa się", async () => {
    const autor = await nowyUzytkownik("blogo-autor");
    const efektId = await dajBlogoslawienstwo(druzyna);
    const taskId = await idZadania(0);
    const zgloszenieId = await wstawZgloszenie(autor, druzyna, taskId);

    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(error).toBeNull();

    const { data: zadanie } = await admin
      .from("bingo_tasks")
      .select("points")
      .eq("id", taskId)
      .single();

    const { data: wpis } = await admin
      .from("points_ledger")
      .select("delta, reason")
      .eq("ref_type", "bingo_zadanie")
      .eq("ref_id", zgloszenieId)
      .single();
    expect(wpis!.delta).toBe(zadanie!.points * 2);
    // Księga jest jawna. Niewyjaśniona czterdziestka przy ognisku to gotowa
    // kłótnia, więc wpis musi sam powiedzieć, skąd się wzięła.
    expect(wpis!.reason).toMatch(/blogoslawienstwo/i);

    const { data: efekt } = await admin
      .from("active_effects")
      .select("consumed_at")
      .eq("id", efektId)
      .single();
    expect(efekt!.consumed_at).not.toBeNull();
  });

  it("działa dokładnie raz", async () => {
    const autor = await nowyUzytkownik("blogo-raz");
    await dajBlogoslawienstwo(druzyna);

    const pierwszeZad = await idZadania(1);
    const pierwsze = await wstawZgloszenie(autor, druzyna, pierwszeZad);
    await adminClient.rpc("review_bingo", { p_submission_id: pierwsze, p_approve: true });

    const drugieZad = await idZadania(2);
    const drugie = await wstawZgloszenie(autor, druzyna, drugieZad);
    await adminClient.rpc("review_bingo", { p_submission_id: drugie, p_approve: true });

    const { data: zadanie } = await admin
      .from("bingo_tasks")
      .select("points")
      .eq("id", drugieZad)
      .single();

    const { data: wpis } = await admin
      .from("points_ledger")
      .select("delta")
      .eq("ref_id", drugie)
      .single();
    expect(wpis!.delta).toBe(zadanie!.points);
  });

  it("przedawnione nie działa", async () => {
    const autor = await nowyUzytkownik("blogo-stare");
    await dajBlogoslawienstwo(druzyna, { godziny: -1 });
    const taskId = await idZadania(3);
    const zgloszenieId = await wstawZgloszenie(autor, druzyna, taskId);

    await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });

    const { data: zadanie } = await admin
      .from("bingo_tasks")
      .select("points")
      .eq("id", taskId)
      .single();
    const { data: wpis } = await admin
      .from("points_ledger")
      .select("delta")
      .eq("ref_id", zgloszenieId)
      .single();
    expect(wpis!.delta).toBe(zadanie!.points);
  });

  it("odrzucenie nie zużywa błogosławieństwa", async () => {
    const autor = await nowyUzytkownik("blogo-odrzut");
    const efektId = await dajBlogoslawienstwo(druzyna);
    const taskId = await idZadania(4);
    const zgloszenieId = await wstawZgloszenie(autor, druzyna, taskId);

    await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: false,
      p_note: "nie to zadanie",
    });

    const { data: efekt } = await admin
      .from("active_effects")
      .select("consumed_at")
      .eq("id", efektId)
      .single();
    expect(efekt!.consumed_at).toBeNull();
  });

  it("nie podwaja bonusu za linię", async () => {
    const autor = await nowyUzytkownik("blogo-linia");
    await dajBlogoslawienstwo(druzyna);
    await zapal(druzyna, autor.id, [0, 1, 2, 3]);

    const taskId = await idZadania(4);
    const zgloszenieId = await wstawZgloszenie(autor, druzyna, taskId);
    await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });

    const { data: ustawienie } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "bingo_bonus_linia")
      .single();
    const bonus = Number(ustawienie!.value);

    // Bonus jest zasługą zbiorową przyznawaną raz na linię. Podwojenie go
    // zależałoby od tego, kogo admin kliknął pierwszego.
    const { data: wpis } = await admin
      .from("points_ledger")
      .select("delta")
      .eq("ref_type", "bingo_linia")
      .eq("ref_id", "wiersz-0")
      .single();
    expect(wpis!.delta).toBe(bonus);
  });

  it("bonusy za linię i planszę działają po podmianie funkcji", async () => {
    const autor = await nowyUzytkownik("blogo-regresja");

    // Bez błogosławieństwa — to test regresji, nie efektu. Sprawdza, że
    // przeniesienie ciała review_bingo nie zgubiło pętli bonusów.
    const wszystkie = Array.from({ length: 25 }, (_, i) => i);
    await zapal(
      druzyna,
      autor.id,
      wszystkie.filter((p) => p !== 24),
    );

    const taskId = await idZadania(24);
    const zgloszenieId = await wstawZgloszenie(autor, druzyna, taskId);
    const { error } = await adminClient.rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: true,
    });
    expect(error).toBeNull();

    const { data: linie } = await admin
      .from("points_ledger")
      .select("ref_id")
      .eq("ref_type", "bingo_linia");
    expect(linie).toHaveLength(12);

    const { data: plansza } = await admin
      .from("points_ledger")
      .select("id, user_id")
      .eq("ref_type", "bingo_plansza");
    expect(plansza).toHaveLength(1);
    expect(plansza![0].user_id).toBeNull();
  });
});
