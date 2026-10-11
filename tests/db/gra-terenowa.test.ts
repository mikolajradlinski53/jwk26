import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  firstTeamId,
  idZadania,
  zapal,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

// Gra terenowa (paczka D1): quest to wiersz bingo_tasks z rodzajem 'quest'.
// Odkrywa go admin, drużyna wysyła jedno zgłoszenie, punkty bez bonusów planszy.
let szef: TestUser;
let gracz: TestUser;
let szefClient: SupabaseClient;
let graczClient: SupabaseClient;
let teamId: string;
let questId: string;

beforeAll(async () => {
  teamId = await firstTeamId();
  [szef, gracz] = await Promise.all([createUser("szef-gra"), createUser("gracz-gra")]);
  await makeAdmin(szef);
  await ustawJakoZaakceptowany(gracz, teamId);
  szefClient = await signIn(szef);
  graczClient = await signIn(gracz);
});

afterEach(async () => {
  await admin.from("bingo_submissions").delete().not("id", "is", null);
  await admin.from("points_ledger").delete().in("category", ["bingo", "bingo_bonus", "gra_terenowa"]);
  await admin.from("bingo_tasks").delete().eq("rodzaj", "quest");
  await admin.from("powiadomienia").delete().in("ref_type", ["quest", "bingo"]);
});

afterAll(async () => {
  await Promise.all([szef, gracz].map(deleteUser));
});

async function nowyQuest(odkryte = false) {
  const { data, error } = await szefClient
    .from("bingo_tasks")
    .insert({ rodzaj: "quest", title: "Zdobądź szczyt", description: "Zdjęcie drużyny na szczycie", points: 70, odkryte })
    .select("id")
    .single();
  if (error) throw error;
  questId = data.id as string;
  return questId;
}

function zglos(client: SupabaseClient, user: TestUser, taskId: string) {
  return client
    .from("bingo_submissions")
    .insert({ user_id: user.id, team_id: teamId, task_id: taskId, photo_path: `${user.id}/quest.jpg`, caption: "Jesteśmy" })
    .select("id")
    .single();
}

describe("gra terenowa", () => {
  it("nieodkryty quest widzi tylko admin i nie da się do niego nic wysłać", async () => {
    const id = await nowyQuest(false);
    const { data: widzi } = await graczClient.from("bingo_tasks").select("id").eq("id", id);
    expect(widzi).toEqual([]);
    const { data: adminWidzi } = await szefClient.from("bingo_tasks").select("id").eq("id", id);
    expect(adminWidzi).toHaveLength(1);
    expect((await zglos(graczClient, gracz, id)).error).not.toBeNull();
  });

  it("odkrycie ogłasza zadanie wszystkim, potem drużyna wysyła jedno zgłoszenie", async () => {
    const id = await nowyQuest(false);
    expect((await szefClient.from("bingo_tasks").update({ odkryte: true }).eq("id", id)).error).toBeNull();

    const { data: push } = await admin
      .from("powiadomienia")
      .select("adresat, tytul, body, link")
      .eq("ref_type", "quest")
      .eq("ref_id", id)
      .single();
    expect(push).toEqual({
      adresat: "all",
      tytul: "Nowe zadanie w grze terenowej",
      body: "Zdobądź szczyt - 70 pkt dla drużyny",
      link: "/app/gra",
    });

    expect((await zglos(graczClient, gracz, id)).error).toBeNull();
    // Drugie zgłoszenie tej samej drużyny odbija unikalny indeks.
    expect((await zglos(graczClient, gracz, id)).error).not.toBeNull();
  });

  it("przyjęty quest daje punkty drużynie, bez bonusów planszy, z własnym powiadomieniem", async () => {
    const id = await nowyQuest(true);
    const { data: z } = await zglos(graczClient, gracz, id);
    expect((await szefClient.rpc("review_bingo", { p_submission_id: z!.id, p_approve: true })).error).toBeNull();

    const { data: wpisy } = await admin
      .from("points_ledger")
      .select("team_id, delta, category")
      .eq("ref_id", z!.id);
    expect(wpisy).toEqual([{ team_id: teamId, delta: 70, category: "gra_terenowa" }]);

    const { data: push } = await admin
      .from("powiadomienia")
      .select("tytul, link")
      .eq("ref_type", "bingo")
      .eq("ref_id", z!.id)
      .single();
    expect(push).toEqual({ tytul: "Zadanie gry terenowej zaliczone", link: "/app/gra" });
  });

  it("zaliczony quest nie dopełnia planszy: 24 pola + quest to nie pełna plansza", async () => {
    const id = await nowyQuest(true);
    // 23 pola zapalone na skróty, quest przyjęty, 24. pole przez review_bingo.
    await zapal(teamId, gracz.id, Array.from({ length: 23 }, (_, i) => i));
    const { data: q } = await zglos(graczClient, gracz, id);
    await szefClient.rpc("review_bingo", { p_submission_id: q!.id, p_approve: true });

    const { data: pole } = await admin
      .from("bingo_submissions")
      .insert({ user_id: gracz.id, team_id: teamId, task_id: await idZadania(23), photo_path: `${gracz.id}/p.jpg` })
      .select("id")
      .single();
    expect((await szefClient.rpc("review_bingo", { p_submission_id: pole!.id, p_approve: true })).error).toBeNull();

    const { count } = await admin
      .from("points_ledger")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("ref_type", "bingo_plansza");
    expect(count).toBe(0);
  });

  it("quest musi być bez pola planszy, a zadanie bingo - z polem", async () => {
    const { error: questZPolem } = await admin
      .from("bingo_tasks")
      .insert({ rodzaj: "quest", position: 3, title: "x", description: "x" });
    expect(questZPolem).not.toBeNull();
    const { error: bingoBezPola } = await admin
      .from("bingo_tasks")
      .insert({ rodzaj: "bingo", title: "x", description: "x" });
    expect(bingoBezPola).not.toBeNull();
  });
});
