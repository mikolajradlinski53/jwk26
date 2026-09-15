import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  makeAdmin,
  approve,
  firstTeamId,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

afterEach(async () => {
  while (sprzatanie.length) {
    const user = sprzatanie.pop()!;
    await admin.from("registrations").delete().eq("user_id", user.id);
    await deleteUser(user);
  }
});

async function nowyUzytkownik(tag: string) {
  const user = await createUser(tag);
  sprzatanie.push(user);
  return user;
}

/** Minimalne poprawne zgłoszenie dla danego użytkownika. */
function zgloszenie(user: TestUser) {
  return {
    user_id: user.id,
    full_name: "Brat Testowy",
    phone: "600100200",
    sms_consent: true,
    proof_path: `${user.id}/dowod.jpg`,
  };
}

describe("zgłoszenia rejestracyjne", () => {
  it("pozwala złożyć własne zgłoszenie", async () => {
    const user = await nowyUzytkownik("zglasza");
    const client = await signIn(user);

    const { error } = await client.from("registrations").insert(zgloszenie(user));

    expect(error).toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia w cudzym imieniu", async () => {
    const obcy = await nowyUzytkownik("ofiara");
    const sprytny = await nowyUzytkownik("podszywacz");
    const client = await signIn(sprytny);

    const { error } = await client.from("registrations").insert(zgloszenie(obcy));

    expect(error).not.toBeNull();
  });

  it("nie pozwala wskazać cudzego dowodu przelewu", async () => {
    // Bez warunku na proof_path w polityce INSERT uczestnik podpiąłby pod swoje
    // zgłoszenie ścieżkę do cudzego pliku i zobaczyłby go w podglądzie admina.
    const obcy = await nowyUzytkownik("wlasciciel");
    const sprytny = await nowyUzytkownik("zerkacz");
    const client = await signIn(sprytny);

    const { error } = await client.from("registrations").insert({
      ...zgloszenie(sprytny),
      proof_path: `${obcy.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia od razu zaakceptowanego", async () => {
    const user = await nowyUzytkownik("cwaniak");
    const client = await signIn(user);

    const { error } = await client
      .from("registrations")
      .insert({ ...zgloszenie(user), status: "approved" });

    expect(error).not.toBeNull();
  });

  it("nie pokazuje cudzych zgłoszeń", async () => {
    const obcy = await nowyUzytkownik("skryty");
    await admin.from("registrations").insert(zgloszenie(obcy));

    const patrzacy = await nowyUzytkownik("ciekawski");
    const client = await signIn(patrzacy);

    const { data, error } = await client
      .from("registrations")
      .select("id")
      .eq("user_id", obcy.id);

    // RLS przy odczycie nie zwraca błędu, tylko pusty zbiór — asercja na error
    // niczego by tu nie złapała.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("pokazuje adminowi wszystkie zgłoszenia", async () => {
    const zglaszajacy = await nowyUzytkownik("petent");
    await admin.from("registrations").insert(zgloszenie(zglaszajacy));

    const szef = await nowyUzytkownik("kaplan");
    await makeAdmin(szef);
    const client = await signIn(szef);

    const { data } = await client
      .from("registrations")
      .select("id")
      .eq("user_id", zglaszajacy.id);

    expect(data).toHaveLength(1);
  });

  it("nie pozwala nikomu zmienić statusu zwykłym UPDATE-em", async () => {
    const user = await nowyUzytkownik("uparty");
    const { data: wiersz } = await admin
      .from("registrations")
      .insert(zgloszenie(user))
      .select("id")
      .single();

    const client = await signIn(user);
    const { data: poZmianie } = await client
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", wiersz!.id)
      .select();

    expect(poZmianie).toEqual([]);

    const { data: kontrola } = await admin
      .from("registrations")
      .select("status")
      .eq("id", wiersz!.id)
      .single();
    expect(kontrola!.status).toBe("pending");
  });
});

// Cztery zabezpieczenia dołożone migracją 0003 po przeglądzie — patrz Task 1b.
describe("hartowanie bramy", () => {
  it("nie pozwala złożyć drugiego zgłoszenia, póki pierwsze czeka", async () => {
    const user = await nowyUzytkownik("zalewacz");
    const client = await signIn(user);

    const pierwsze = await client.from("registrations").insert(zgloszenie(user));
    expect(pierwsze.error).toBeNull();

    // Bez unikalnego indeksu częściowego pętla insertów z konsoli zasypałaby
    // kolejkę admina, gdzie każdy wiersz kosztuje osobne createSignedUrl.
    const drugie = await client.from("registrations").insert(zgloszenie(user));
    expect(drugie.error).not.toBeNull();
  });

  it("nie pozwala wskazać ścieżki wychodzącej z własnego folderu", async () => {
    const obcy = await nowyUzytkownik("sasiad");
    const sprytny = await nowyUzytkownik("wedrowiec");
    const client = await signIn(sprytny);

    // `like 'uuid/%'` sam w sobie to przepuszcza, a klient Storage normalizuje
    // `..` przy budowaniu URL-a — czyli trafiłoby na cudzy plik.
    const { error } = await client.from("registrations").insert({
      ...zgloszenie(sprytny),
      proof_path: `${sprytny.id}/../${obcy.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia osobie już zaakceptowanej", async () => {
    const teamId = await firstTeamId();
    const user = await nowyUzytkownik("juz-w-srodku");
    await approve(user, teamId);
    const client = await signIn(user);

    // Inaczej odrzucenie takiego zgłoszenia zbiłoby jej status na 'rejected'
    // i wyrzuciło ją z aplikacji, mimo że była już w drużynie.
    const { error } = await client.from("registrations").insert(zgloszenie(user));

    expect(error).not.toBeNull();
  });

  it("odrzuca pewność OCR spoza zakresu 0-1", async () => {
    const user = await nowyUzytkownik("fantasta");
    const client = await signIn(user);

    const { error } = await client
      .from("registrations")
      .insert({ ...zgloszenie(user), ocr_confidence: 5 });

    expect(error).not.toBeNull();
  });
});
