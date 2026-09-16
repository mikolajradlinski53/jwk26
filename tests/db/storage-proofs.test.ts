import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  sprzatanieUzytkownikow,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();
const pliki: string[] = [];

// Jeden zwykły uczestnik i jeden admin na cały plik. Polityki na buckecie
// „proofs" patrzą tylko na auth.uid() (własny folder) albo na rolę admina —
// obie da się sprawdzić żywą sesją jednej osoby na rolę, założoną raz.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let szef: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  uczestnik = await createUser("uczestnik-dowody");
  uczestnikClient = await signIn(uczestnik);
  szef = await createUser("kaplan-dowody");
  await makeAdmin(szef);
  adminClient = await signIn(szef);
});

afterAll(async () => {
  await deleteUser(uczestnik);
  await deleteUser(szef);
});

afterEach(async () => {
  // Pliki najpierw. Storage nie ma kaskady na auth.users, więc po skasowaniu
  // użytkownika jego dowód zostałby w buckecie na zawsze.
  if (pliki.length) {
    await admin.storage.from("proofs").remove(pliki.splice(0));
  }
  await posprzataj();
});

/** Najmniejszy sensowny ładunek — treść nie ma znaczenia, liczy się ścieżka. */
function atrapaZdjecia(): Blob {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
    type: "image/jpeg",
  });
}

describe("bucket z dowodami przelewu", () => {
  it("pozwala wrzucić plik do własnego folderu", async () => {
    const sciezka = `${uczestnik.id}/dowod.jpg`;

    const { error } = await uczestnikClient.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });

    expect(error).toBeNull();
    pliki.push(sciezka);
  });

  it("nie pozwala wrzucić pliku do cudzego folderu", async () => {
    const obcy = await nowyUzytkownik("wlasciciel");

    const { error } = await uczestnikClient.storage
      .from("proofs")
      .upload(`${obcy.id}/podrzucone.jpg`, atrapaZdjecia(), {
        contentType: "image/jpeg",
      });

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi pobrać cudzego dowodu", async () => {
    const obcy = await nowyUzytkownik("platnik");
    const sciezka = `${obcy.id}/dowod.jpg`;
    const { error: bladZapisu } = await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    expect(bladZapisu).toBeNull();
    pliki.push(sciezka);

    const { error } = await uczestnikClient.storage.from("proofs").download(sciezka);

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi pobrać nawet własnego dowodu", async () => {
    // Polityka SELECT jest wyłącznie dla admina — świadomie, zgodnie ze specem.
    // Autor widział zdjęcie przed wysłaniem i nie ma po co do niego wracać.
    const sciezka = `${uczestnik.id}/dowod.jpg`;
    const { error: bladZapisu } = await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    expect(bladZapisu).toBeNull();
    pliki.push(sciezka);

    const { error } = await uczestnikClient.storage.from("proofs").download(sciezka);

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi podmienić ani skasować dowodu", async () => {
    // Brak polityk UPDATE i DELETE. Gdyby któraś istniała, autor mógłby po
    // akceptacji podmienić dowód albo zatrzeć ślad po odrzuconym zgłoszeniu.
    const sciezka = `${uczestnik.id}/dowod.jpg`;

    const { error: bladZapisu } = await uczestnikClient.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    expect(bladZapisu).toBeNull();
    pliki.push(sciezka);

    const { error: bladPodmiany } = await uczestnikClient.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), {
        contentType: "image/jpeg",
        upsert: true,
      });
    expect(bladPodmiany).not.toBeNull();

    const { error: bladKasowania } = await uczestnikClient.storage
      .from("proofs")
      .remove([sciezka]);

    // Plik ma przetrwać — niezależnie od tego, czy API zgłosi błąd, czy po
    // cichu nic nie zrobi. Liczy się stan bucketu, nie kształt odpowiedzi.
    const { data: nadalJest } = await admin.storage
      .from("proofs")
      .download(sciezka);
    expect(nadalJest).not.toBeNull();
    void bladKasowania;
  });

  it("pozwala adminowi wygenerować podpisany URL", async () => {
    const platnik = await nowyUzytkownik("oplacony");
    const sciezka = `${platnik.id}/dowod.jpg`;
    const { error: bladZapisu } = await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    expect(bladZapisu).toBeNull();
    pliki.push(sciezka);

    const { data, error } = await adminClient.storage
      .from("proofs")
      .createSignedUrl(sciezka, 60);

    expect(error).toBeNull();
    expect(data!.signedUrl).toContain("/proofs/");
  });

  it("odrzuca plik o niedozwolonym typie", async () => {
    // allowed_mime_types na buckecie: jpeg, png, webp. PDF przechodziłby przez
    // politykę RLS — zatrzymuje go dopiero konfiguracja bucketu.
    const { error } = await uczestnikClient.storage
      .from("proofs")
      .upload(`${uczestnik.id}/dowod.pdf`, new Blob(["%PDF-1.4"], {
        type: "application/pdf",
      }), { contentType: "application/pdf" });

    expect(error).not.toBeNull();
  });
});
