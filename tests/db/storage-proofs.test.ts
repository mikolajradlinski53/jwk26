import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  signIn,
  sprzatanieUzytkownikow,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();
const pliki: string[] = [];

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
    const user = await nowyUzytkownik("wrzucacz");
    const client = await signIn(user);
    const sciezka = `${user.id}/dowod.jpg`;

    const { error } = await client.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });

    expect(error).toBeNull();
    pliki.push(sciezka);
  });

  it("nie pozwala wrzucić pliku do cudzego folderu", async () => {
    const obcy = await nowyUzytkownik("wlasciciel");
    const sprytny = await nowyUzytkownik("intruz");
    const client = await signIn(sprytny);

    const { error } = await client.storage
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

    const ciekawski = await nowyUzytkownik("ciekawski");
    const client = await signIn(ciekawski);

    const { error } = await client.storage.from("proofs").download(sciezka);

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi pobrać nawet własnego dowodu", async () => {
    // Polityka SELECT jest wyłącznie dla admina — świadomie, zgodnie ze specem.
    // Autor widział zdjęcie przed wysłaniem i nie ma po co do niego wracać.
    const user = await nowyUzytkownik("autor");
    const sciezka = `${user.id}/dowod.jpg`;
    const { error: bladZapisu } = await admin.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    expect(bladZapisu).toBeNull();
    pliki.push(sciezka);

    const client = await signIn(user);
    const { error } = await client.storage.from("proofs").download(sciezka);

    expect(error).not.toBeNull();
  });

  it("nie pozwala uczestnikowi podmienić ani skasować dowodu", async () => {
    // Brak polityk UPDATE i DELETE. Gdyby któraś istniała, autor mógłby po
    // akceptacji podmienić dowód albo zatrzeć ślad po odrzuconym zgłoszeniu.
    const user = await nowyUzytkownik("podmieniacz");
    const client = await signIn(user);
    const sciezka = `${user.id}/dowod.jpg`;

    const { error: bladZapisu } = await client.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), { contentType: "image/jpeg" });
    expect(bladZapisu).toBeNull();
    pliki.push(sciezka);

    const { error: bladPodmiany } = await client.storage
      .from("proofs")
      .upload(sciezka, atrapaZdjecia(), {
        contentType: "image/jpeg",
        upsert: true,
      });
    expect(bladPodmiany).not.toBeNull();

    const { error: bladKasowania } = await client.storage
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

    const szef = await nowyAdmin("kaplan");
    const client = await signIn(szef);

    const { data, error } = await client.storage
      .from("proofs")
      .createSignedUrl(sciezka, 60);

    expect(error).toBeNull();
    expect(data!.signedUrl).toContain("/proofs/");
  });

  it("odrzuca plik o niedozwolonym typie", async () => {
    // allowed_mime_types na buckecie: jpeg, png, webp. PDF przechodziłby przez
    // politykę RLS — zatrzymuje go dopiero konfiguracja bucketu.
    const user = await nowyUzytkownik("pedeefiarz");
    const client = await signIn(user);

    const { error } = await client.storage
      .from("proofs")
      .upload(`${user.id}/dowod.pdf`, new Blob(["%PDF-1.4"], {
        type: "application/pdf",
      }), { contentType: "application/pdf" });

    expect(error).not.toBeNull();
  });
});
