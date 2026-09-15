import { describe, it, expect, afterEach } from "vitest";
import {
  admin,
  createUser,
  signIn,
  deleteUser,
  makeAdmin,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

const sprzatanie: TestUser[] = [];

afterEach(async () => {
  while (sprzatanie.length) {
    const user = sprzatanie.pop()!;
    // Redundantne wobec kaskady z profiles — zostawione jako polisa.
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

    const { error } = await client.from("registrations").insert({
      ...zgloszenie(obcy),
      // Własna ścieżka, żeby jedynym naruszeniem był user_id. Inaczej test
      // przechodzi także po usunięciu warunku, który rzekomo pilnuje.
      proof_path: `${sprytny.id}/dowod.jpg`,
    });

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
    const { error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenie(obcy));
    // Bez tego test byłby zielony także wtedy, gdyby wiersz w ogóle nie powstał
    // — „nie widzę" nic nie znaczy, kiedy nie ma czego widzieć.
    expect(bladZapisu).toBeNull();

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
    const { error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenie(zglaszajacy));
    // Bez tego test byłby zielony także wtedy, gdyby wiersz w ogóle nie powstał
    // — „nie widzę" nic nie znaczy, kiedy nie ma czego widzieć.
    expect(bladZapisu).toBeNull();

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

  it("pokazuje uczestnikowi jego własne zgłoszenie", async () => {
    const user = await nowyUzytkownik("wlasciciel-zgloszenia");
    const client = await signIn(user);

    const { error: bladZapisu } = await client
      .from("registrations")
      .insert(zgloszenie(user));
    expect(bladZapisu).toBeNull();

    // Na tym odczycie stoi cały ekran /rejestracja: to on decyduje, czy pokazać
    // poczekalnię, formularz, czy notatkę o odrzuceniu. Bez testu ten człon
    // polityki mógłby wypaść niezauważony.
    const { data } = await client.from("registrations").select("id, status");

    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("pending");
  });
});

// Zabezpieczenia z migracji 20260915120200_hartowanie_bramy.sql.
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
    const user = await nowyUzytkownik("juz-w-srodku");
    await ustawJakoZaakceptowany(user);
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

  it("nie pozwala nawet adminowi zmienić statusu zwykłym UPDATE-em", async () => {
    const petent = await nowyUzytkownik("podopieczny");
    const { data: wiersz, error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenie(petent))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    const szef = await nowyUzytkownik("kaplan-update");
    await makeAdmin(szef);
    const client = await signIn(szef);

    // To ta połowa reguły, którą ktoś odruchowo „naprawi", dokładając
    // registrations_admin_write na wzór teams_admin_write z migracji 0001.
    // Wtedy znika gwarancja, że profiles.status zmienia się wyłącznie przez
    // review_registration.
    const { data: poZmianie } = await client
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", wiersz!.id)
      .select();

    expect(poZmianie).toEqual([]);
  });

  it("nie pozwala skasować zgłoszenia", async () => {
    const user = await nowyUzytkownik("wycofujacy");
    const client = await signIn(user);
    const { data: wiersz, error: bladZapisu } = await client
      .from("registrations")
      .insert(zgloszenie(user))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Gdyby DELETE był dozwolony, unikalny indeks na czekających zgłoszeniach
    // przestałby cokolwiek chronić: pętla delete+insert zasypuje kolejkę admina.
    const { data: poKasowaniu } = await client
      .from("registrations")
      .delete()
      .eq("id", wiersz!.id)
      .select();

    expect(poKasowaniu).toEqual([]);

    const { data: kontrola } = await admin
      .from("registrations")
      .select("id")
      .eq("id", wiersz!.id);
    expect(kontrola).toHaveLength(1);
  });

  it("pozwala złożyć zgłoszenie ponownie po odrzuceniu", async () => {
    const user = await nowyUzytkownik("druga-szansa");
    const client = await signIn(user);

    const { data: pierwsze, error: bladZapisu } = await client
      .from("registrations")
      .insert(zgloszenie(user))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Odrzucenie kluczem serwisowym — samą funkcję review_registration bada Task 3.
    await admin
      .from("registrations")
      .update({ status: "rejected" })
      .eq("id", pierwsze!.id);

    // Indeks jest częściowy (where status = 'pending'). Gdyby ktoś zapisał go
    // bez tego warunku, osoba odrzucona nigdy nie złożyłaby zgłoszenia ponownie,
    // a ekran „Ponowna próba" z Taska 7 byłby ślepą uliczką.
    const { error } = await client.from("registrations").insert(zgloszenie(user));

    expect(error).toBeNull();
  });

  it("odrzuca liczbę trafionych słów spoza zakresu 0-6", async () => {
    const user = await nowyUzytkownik("liczykrupa");
    const client = await signIn(user);

    const { error } = await client
      .from("registrations")
      .insert({ ...zgloszenie(user), ocr_keywords_hit: 99 });

    expect(error).not.toBeNull();
  });
});
