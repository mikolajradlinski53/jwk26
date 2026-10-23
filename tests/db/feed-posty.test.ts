import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  idDruzyn,
  idZadania,
  zgloszenieBingoDla,
  ustawJakoZaakceptowany,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

// Swobodne posty w feedzie (2026-10-21): wiersz bingo_submissions bez zadania,
// od razu `approved`. Trzy sesje na cały plik - autor, ktoś obcy z innej
// drużyny i admin - bo projekt testowy liczy logowania.
let autor: TestUser;
let autorClient: SupabaseClient;
let obcy: TestUser;
let obcyClient: SupabaseClient;
let szef: TestUser;
let adminClient: SupabaseClient;
let druzynaAutora: string;
let druzynaObcego: string;

beforeAll(async () => {
  [druzynaAutora, druzynaObcego] = await idDruzyn();
  autor = await createUser("autor-posta");
  await ustawJakoZaakceptowany(autor, druzynaAutora);
  autorClient = await signIn(autor);
  obcy = await createUser("obcy-posta");
  await ustawJakoZaakceptowany(obcy, druzynaObcego);
  obcyClient = await signIn(obcy);
  szef = await createUser("kaplan-posty");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(autor);
  await deleteUser(obcy);
  await deleteUser(szef);
});

afterEach(async () => {
  await admin.from("bingo_submissions").delete().in("user_id", [autor.id, obcy.id]);
  await ustawJakoZaakceptowany(autor, druzynaAutora);
});

function post(kto: TestUser, druzyna: string, nadpisz: Record<string, unknown> = {}) {
  return {
    user_id: kto.id,
    team_id: druzyna,
    task_id: null,
    photo_path: `${kto.id}/${crypto.randomUUID()}.jpg`,
    caption: "Widok z Karpacza",
    status: "approved",
    ...nadpisz,
  };
}

describe("posty w feedzie", () => {
  it("przyjęty uczestnik publikuje post, a inni od razu go widzą", async () => {
    const { data, error } = await autorClient.from("bingo_submissions").insert(post(autor, druzynaAutora)).select("id").single();
    expect(error).toBeNull();

    const { data: widziany } = await obcyClient.from("bingo_submissions").select("id, status").eq("id", data!.id).single();
    expect(widziany).toEqual({ id: data!.id, status: "approved" });
  });

  it("post nie może czekać w kolejce (pending)", async () => {
    const { error } = await autorClient.from("bingo_submissions").insert(post(autor, druzynaAutora, { status: "pending" }));
    expect(error).not.toBeNull();
  });

  it("nie da się wrzucić posta za kogoś, do cudzej drużyny ani do cudzego folderu", async () => {
    const zaKogos = await autorClient.from("bingo_submissions").insert(post(obcy, druzynaObcego));
    expect(zaKogos.error).not.toBeNull();
    const cudzaDruzyna = await autorClient.from("bingo_submissions").insert(post(autor, druzynaObcego));
    expect(cudzaDruzyna.error).not.toBeNull();
    const cudzyFolder = await autorClient
      .from("bingo_submissions")
      .insert(post(autor, druzynaAutora, { photo_path: `${obcy.id}/x.jpg` }));
    expect(cudzyFolder.error).not.toBeNull();
  });

  it("nieprzyjęty uczestnik nie publikuje", async () => {
    await admin.from("profiles").update({ status: "pending" }).eq("id", autor.id);
    const { error } = await autorClient.from("bingo_submissions").insert(post(autor, druzynaAutora));
    expect(error).not.toBeNull();
  });

  it("autor usuwa swój post, obcy nie, admin tak", async () => {
    const { data: a } = await admin.from("bingo_submissions").insert(post(autor, druzynaAutora)).select("id").single();
    const { data: b } = await admin.from("bingo_submissions").insert(post(autor, druzynaAutora)).select("id").single();

    await obcyClient.from("bingo_submissions").delete().eq("id", a!.id);
    expect((await admin.from("bingo_submissions").select("id").eq("id", a!.id)).data).toHaveLength(1);

    await autorClient.from("bingo_submissions").delete().eq("id", a!.id);
    expect((await admin.from("bingo_submissions").select("id").eq("id", a!.id)).data).toHaveLength(0);

    await adminClient.from("bingo_submissions").delete().eq("id", b!.id);
    expect((await admin.from("bingo_submissions").select("id").eq("id", b!.id)).data).toHaveLength(0);
  });

  it("zaakceptowanego zdjęcia z bingo autor dalej nie usunie", async () => {
    const { data } = await admin
      .from("bingo_submissions")
      .insert({ ...zgloszenieBingoDla(autor, druzynaAutora, await idZadania(0)), status: "approved" })
      .select("id")
      .single();
    await autorClient.from("bingo_submissions").delete().eq("id", data!.id);
    expect((await admin.from("bingo_submissions").select("id").eq("id", data!.id)).data).toHaveLength(1);
  });

  it("post nie daje punktów, a review_bingo go nie rusza", async () => {
    const { data } = await autorClient.from("bingo_submissions").insert(post(autor, druzynaAutora)).select("id").single();
    // Kolejka admina bierze tylko `pending` - post nigdy tam nie trafia,
    // a rozpatrzenie go wprost odbija się jak od już rozpatrzonego.
    const { error } = await adminClient.rpc("review_bingo", { p_submission_id: data!.id, p_approve: true });
    expect(error?.message).toMatch(/rozpatrzone/);
    const { data: wpisy } = await admin.from("points_ledger").select("id").eq("user_id", autor.id);
    expect(wpisy).toEqual([]);
  });

  it("pliki: autor kasuje swoje, obcy nie, a zdjęcia pod zadaniem bingo nikt z uczestników", async () => {
    const plik = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
    const istnieje = async (sciezka: string) => {
      const [folder, nazwa] = sciezka.split("/");
      const { data } = await admin.storage.from("bingo").list(folder, { search: nazwa });
      return (data ?? []).some((o) => o.name === nazwa);
    };
    const wgraj = async (sciezka: string) => {
      const { error } = await admin.storage.from("bingo").upload(sciezka, plik, { contentType: "image/jpeg" });
      if (error) throw error;
    };

    const postowy = `${autor.id}/${crypto.randomUUID()}.jpg`;
    const zadaniowy = `${autor.id}/${crypto.randomUUID()}.jpg`;
    await wgraj(postowy);
    await wgraj(zadaniowy);
    await admin
      .from("bingo_submissions")
      .insert({ ...zgloszenieBingoDla(autor, druzynaAutora, await idZadania(0)), photo_path: zadaniowy, status: "approved" });

    try {
      await obcyClient.storage.from("bingo").remove([postowy]);
      expect(await istnieje(postowy)).toBe(true);

      await autorClient.storage.from("bingo").remove([zadaniowy]);
      expect(await istnieje(zadaniowy)).toBe(true);

      await autorClient.storage.from("bingo").remove([postowy]);
      expect(await istnieje(postowy)).toBe(false);
    } finally {
      await admin.storage.from("bingo").remove([postowy, zadaniowy]);
    }
  });

  it("bucket przyjmuje krótkie filmy, ale nie dowolne pliki (2026-10-23)", async () => {
    const film = `${autor.id}/${crypto.randomUUID()}.mp4`;
    const pdf = `${autor.id}/${crypto.randomUUID()}.pdf`;
    const bajty = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    try {
      const ok = await autorClient.storage.from("bingo").upload(film, new Blob([bajty], { type: "video/mp4" }), { contentType: "video/mp4" });
      expect(ok.error).toBeNull();
      const zle = await autorClient.storage.from("bingo").upload(pdf, new Blob([bajty], { type: "application/pdf" }), { contentType: "application/pdf" });
      expect(zle.error).not.toBeNull();
    } finally {
      await admin.storage.from("bingo").remove([film, pdf]);
    }
  });

  it("limit 10 postów na godzinę", async () => {
    const dziesiec = Array.from({ length: 10 }, () => post(autor, druzynaAutora));
    expect((await admin.from("bingo_submissions").insert(dziesiec)).error).toBeNull();
    const { error } = await autorClient.from("bingo_submissions").insert(post(autor, druzynaAutora));
    expect(error?.message).toMatch(/POSTY_LIMIT/);
  });
});
