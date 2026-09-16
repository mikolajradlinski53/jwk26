import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  firstTeamId,
  idZadania,
  zgloszenieBingoDla,
  ustawJakoZaakceptowany,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

// Jeden uczestnik i jeden admin na cały plik, założeni raz w beforeAll —
// jedenaście testów, żaden nie rozróżnia dwóch konkretnych zaakceptowanych
// osób. is_approved()/is_admin() czytają stan z profili na żywo przy każdym
// wywołaniu, więc odebranie/przywrócenie statusu kluczem serwisowym w teście 5
// widać w sesji od razu, bez ponownego logowania. „Ofiara" — właściciel
// cudzych lajków i komentarzy w testach 4 i 10 — nigdy się nie loguje: do
// wstawienia jej danych wystarczy klucz serwisowy, a do dowiedzenia, że
// uczestnik nie może ich skasować, wystarczy jego już istniejąca sesja.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let ofiara: TestUser;
let szef: TestUser;
let adminClient: SupabaseClient;
let teamId: string;
let submissionId: string;

beforeAll(async () => {
  teamId = await firstTeamId();

  uczestnik = await createUser("uczestnik-feed");
  await ustawJakoZaakceptowany(uczestnik, teamId);
  uczestnikClient = await signIn(uczestnik);

  ofiara = await createUser("ofiara-feed");

  szef = await createUser("kaplan-feed");
  await makeAdmin(szef);
  adminClient = await signIn(szef);

  // Jedno zaakceptowane zgłoszenie na cały plik — lajki i komentarze mają FK
  // na bingo_submissions(id), a to, przez które pole zostało zapalone, nie ma
  // tu znaczenia. Wstawione wprost kluczem serwisowym, bez przechodzenia przez
  // review_bingo — nie to jest przedmiotem tych testów.
  const taskId = await idZadania(0);
  const { data, error } = await admin
    .from("bingo_submissions")
    .insert({ ...zgloszenieBingoDla(uczestnik, teamId, taskId), status: "approved" })
    .select("id")
    .single();
  if (error) throw error;
  submissionId = data.id as string;
});

afterAll(async () => {
  await admin.from("feed_likes").delete().eq("submission_id", submissionId);
  await admin.from("feed_comments").delete().eq("submission_id", submissionId);
  await admin.from("bingo_submissions").delete().eq("id", submissionId);
  await deleteUser(uczestnik);
  await deleteUser(ofiara);
  await deleteUser(szef);
});

afterEach(async () => {
  // Lajki i komentarze pod wspólnym zgłoszeniem kasujemy po każdym teście —
  // kolejny test ma zawsze zaczynać od pustego feedu pod tym zgłoszeniem.
  await admin.from("feed_likes").delete().eq("submission_id", submissionId);
  await admin.from("feed_comments").delete().eq("submission_id", submissionId);
  // Test 5 odbiera uczestnikowi status na czas jednego testu — reset tutaj
  // jest bezwarunkowy i bezpieczny również dla testów, które go nie ruszały.
  await ustawJakoZaakceptowany(uczestnik, teamId);
});

describe("warstwa społeczna: lajki i komentarze", () => {
  it("zaakceptowany stawia lajk", async () => {
    const { error } = await uczestnikClient
      .from("feed_likes")
      .insert({ submission_id: submissionId, user_id: uczestnik.id });

    expect(error).toBeNull();

    const { data } = await admin
      .from("feed_likes")
      .select("user_id")
      .eq("submission_id", submissionId);
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(uczestnik.id);
  });

  it("drugi lajk tej samej osoby pada", async () => {
    // Pierwszy przechodzi — dowodzi, że ładunek sam w sobie jest poprawny
    // (FK, is_approved()). Drugi, identyczny, może więc paść już wyłącznie na
    // kluczu głównym (submission_id, user_id), a nie na czymś innym.
    const pierwszy = await uczestnikClient
      .from("feed_likes")
      .insert({ submission_id: submissionId, user_id: uczestnik.id });
    expect(pierwszy.error).toBeNull();

    const drugi = await uczestnikClient
      .from("feed_likes")
      .insert({ submission_id: submissionId, user_id: uczestnik.id });
    expect(drugi.error).not.toBeNull();

    const { data } = await admin
      .from("feed_likes")
      .select("user_id")
      .eq("submission_id", submissionId);
    expect(data).toHaveLength(1);
  });

  it("lajk można cofnąć", async () => {
    const wstawiony = await uczestnikClient
      .from("feed_likes")
      .insert({ submission_id: submissionId, user_id: uczestnik.id });
    expect(wstawiony.error).toBeNull();

    const { data } = await uczestnikClient
      .from("feed_likes")
      .delete()
      .eq("submission_id", submissionId)
      .eq("user_id", uczestnik.id)
      .select();

    expect(data).toHaveLength(1);
  });

  it("nie cofnie cudzego lajka", async () => {
    // Cudzy lajek wstawiony kluczem serwisowym — nie przechodzi przez sesję
    // ofiary, bo do zbadania polityki DELETE wystarczy, że wiersz istnieje
    // i należy do kogoś innego niż uczestnikClient.
    const { error: bladZapisu } = await admin
      .from("feed_likes")
      .insert({ submission_id: submissionId, user_id: ofiara.id });
    expect(bladZapisu).toBeNull();

    const { data: skasowane } = await uczestnikClient
      .from("feed_likes")
      .delete()
      .eq("submission_id", submissionId)
      .eq("user_id", ofiara.id)
      .select();

    // RLS przy DELETE nie zwraca błędu, tylko pustą listę skasowanych wierszy.
    expect(skasowane).toEqual([]);

    const { data: kontrola } = await admin
      .from("feed_likes")
      .select("user_id")
      .eq("submission_id", submissionId)
      .eq("user_id", ofiara.id);
    expect(kontrola).toHaveLength(1);
  });

  it("oczekujący nie postawi lajka", async () => {
    // Ten sam token, świeżo pozbawiony statusu — is_approved() czyta na żywo,
    // więc nie trzeba nowej sesji, żeby zobaczyć efekt.
    await admin.from("profiles").update({ status: "pending" }).eq("id", uczestnik.id);

    const { error } = await uczestnikClient
      .from("feed_likes")
      .insert({ submission_id: submissionId, user_id: uczestnik.id });

    expect(error).not.toBeNull();

    const { data } = await admin
      .from("feed_likes")
      .select("user_id")
      .eq("submission_id", submissionId);
    expect(data).toEqual([]);
  });

  it("zaakceptowany komentuje", async () => {
    const { error } = await uczestnikClient
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: uczestnik.id, body: "Świetne zdjęcie!" });

    expect(error).toBeNull();

    const { data } = await admin
      .from("feed_comments")
      .select("body")
      .eq("submission_id", submissionId);
    expect(data).toHaveLength(1);
    expect(data![0].body).toBe("Świetne zdjęcie!");
  });

  it("pusty komentarz pada", async () => {
    // Kontrola tym samym ładunkiem z sensowną treścią — przechodzi. Jeśli
    // wersja z samymi spacjami padnie, to wyłącznie przez ograniczenie na
    // body (length(trim(body)) between 1 and 500), nie przez coś innego.
    const kontrola = await uczestnikClient
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: uczestnik.id, body: "kontrola" });
    expect(kontrola.error).toBeNull();

    const { error } = await uczestnikClient
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: uczestnik.id, body: "    " });

    expect(error).not.toBeNull();
  });

  it("za długi komentarz pada", async () => {
    const kontrola = await uczestnikClient
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: uczestnik.id, body: "kontrola" });
    expect(kontrola.error).toBeNull();

    const zaDlugi = "a".repeat(501);
    const { error } = await uczestnikClient
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: uczestnik.id, body: zaDlugi });

    expect(error).not.toBeNull();
  });

  it("autor kasuje własny komentarz", async () => {
    const { data: wiersz, error: bladZapisu } = await uczestnikClient
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: uczestnik.id, body: "Do skasowania" })
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: skasowane } = await uczestnikClient
      .from("feed_comments")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(skasowane).toHaveLength(1);
  });

  it("uczestnik nie skasuje cudzego", async () => {
    const { data: wiersz, error: bladZapisu } = await admin
      .from("feed_comments")
      .insert({ submission_id: submissionId, user_id: ofiara.id, body: "Cudzy komentarz" })
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: poKasowaniu } = await uczestnikClient
      .from("feed_comments")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin
      .from("feed_comments")
      .select("id")
      .eq("id", wiersz!.id);
    expect(kontrola).toHaveLength(1);
  });

  it("admin kasuje cudzy", async () => {
    const { data: wiersz, error: bladZapisu } = await admin
      .from("feed_comments")
      .insert({
        submission_id: submissionId,
        user_id: uczestnik.id,
        body: "Do skasowania przez admina",
      })
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const { data: skasowane } = await adminClient
      .from("feed_comments")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(skasowane).toHaveLength(1);
  });
});
