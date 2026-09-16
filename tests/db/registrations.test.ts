import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
  zgloszenieDla,
  createUser,
  deleteUser,
  makeAdmin,
  type TestUser,
} from "../helpers/supabase";

const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Jeden zwykły uczestnik i jeden admin na cały plik, założeni raz w beforeAll:
// siedemnaście testów, żaden nie bada rozróżnienia między dwiema konkretnymi
// osobami tego samego typu — sprawdzają wyłącznie, co wolno „jakiemuś"
// uczestnikowi albo „jakiemuś" adminowi. is_admin()/is_approved() to funkcje
// security definer czytające rolę i status na żywo z profili przy każdym
// wywołaniu, więc zmiana statusu kluczem serwisowym (np. ustawJakoZaakceptowany)
// jest widoczna w sesji natychmiast, bez ponownego logowania.
let uczestnik: TestUser;
let uczestnikClient: SupabaseClient;
let adminUser: TestUser;
let adminClient: SupabaseClient;

beforeAll(async () => {
  uczestnik = await createUser("uczestnik-rejestracje");
  uczestnikClient = await signIn(uczestnik);
  adminUser = await createUser("kaplan-rejestracje");
  await makeAdmin(adminUser);
  adminClient = await signIn(adminUser);
});

afterAll(async () => {
  await deleteUser(uczestnik);
  await deleteUser(adminUser);
});

afterEach(async () => {
  // Zgłoszenia współdzielonego uczestnika czyścimy jawnie — inaczej unikalny
  // indeks częściowy (status='pending') zablokowałby insert w kolejnym
  // teście. Status też resetujemy: test hartowania bramy zatwierdza tego
  // uczestnika kluczem serwisowym, więc bez resetu kolejny test zastałby go
  // już zaakceptowanym.
  await admin.from("registrations").delete().in("user_id", [uczestnik.id, adminUser.id]);
  await admin
    .from("profiles")
    .update({ status: "pending", team_id: null })
    .eq("id", uczestnik.id);
  await posprzataj();
});

describe("zgłoszenia rejestracyjne", () => {
  it("pozwala złożyć własne zgłoszenie", async () => {
    const { error } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));

    expect(error).toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia w cudzym imieniu", async () => {
    const obcy = await nowyUzytkownik("ofiara");

    const { error } = await uczestnikClient.from("registrations").insert({
      ...zgloszenieDla(obcy),
      // Własna ścieżka, żeby jedynym naruszeniem był user_id. Inaczej test
      // przechodzi także po usunięciu warunku, który rzekomo pilnuje.
      proof_path: `${uczestnik.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala wskazać cudzego dowodu przelewu", async () => {
    // Bez warunku na proof_path w polityce INSERT uczestnik podpiąłby pod swoje
    // zgłoszenie ścieżkę do cudzego pliku i zobaczyłby go w podglądzie admina.
    const obcy = await nowyUzytkownik("wlasciciel");

    const { error } = await uczestnikClient.from("registrations").insert({
      ...zgloszenieDla(uczestnik),
      proof_path: `${obcy.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia od razu zaakceptowanego", async () => {
    const { error } = await uczestnikClient
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), status: "approved" });

    expect(error).not.toBeNull();
  });

  it("nie pokazuje cudzych zgłoszeń", async () => {
    const obcy = await nowyUzytkownik("skryty");
    const { error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenieDla(obcy));
    // Bez tego test byłby zielony także wtedy, gdyby wiersz w ogóle nie powstał
    // — „nie widzę" nic nie znaczy, kiedy nie ma czego widzieć.
    expect(bladZapisu).toBeNull();

    const { data, error } = await uczestnikClient
      .from("registrations")
      .select("id")
      .eq("user_id", obcy.id);

    // RLS przy odczycie nie zwraca błędu, tylko pusty zbiór — asercja na
    // error niczego by tu nie złapała.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("pokazuje adminowi wszystkie zgłoszenia", async () => {
    const zglaszajacy = await nowyUzytkownik("petent");
    const { error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenieDla(zglaszajacy));
    // Bez tego test byłby zielony także wtedy, gdyby wiersz w ogóle nie powstał
    // — „nie widzę" nic nie znaczy, kiedy nie ma czego widzieć.
    expect(bladZapisu).toBeNull();

    const { data } = await adminClient
      .from("registrations")
      .select("id")
      .eq("user_id", zglaszajacy.id);

    expect(data).toHaveLength(1);
  });

  it("nie pozwala uczestnikowi zmienić statusu zwykłym UPDATE-em", async () => {
    const { data: wiersz } = await admin
      .from("registrations")
      .insert(zgloszenieDla(uczestnik))
      .select("id")
      .single();

    const { data: poZmianie } = await uczestnikClient
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

  it("nie pozwala nawet adminowi zmienić statusu zwykłym UPDATE-em", async () => {
    const petent = await nowyUzytkownik("podopieczny");
    const { data: wiersz, error: bladZapisu } = await admin
      .from("registrations")
      .insert(zgloszenieDla(petent))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Kontrola: admin ten wiersz widzi. Bez tego puste [] przy UPDATE mogłoby
    // równie dobrze znaczyć „nie widzę wiersza", a nie „nie wolno mi go zmienić".
    const { data: widoczny } = await adminClient
      .from("registrations")
      .select("id")
      .eq("id", wiersz!.id);
    expect(widoczny).toHaveLength(1);

    // To ta połowa reguły, którą ktoś odruchowo „naprawi", dokładając
    // registrations_admin_write na wzór teams_admin_write z migracji 0001.
    // Wtedy znika gwarancja, że profiles.status zmienia się wyłącznie przez
    // review_registration.
    const { data: poZmianie } = await adminClient
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

  it("nie pozwala skasować zgłoszenia", async () => {
    const { data: wiersz, error: bladZapisu } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik))
      .select("id")
      .single();
    expect(bladZapisu).toBeNull();

    // Gdyby DELETE był dozwolony, unikalny indeks na czekających zgłoszeniach
    // przestałby cokolwiek chronić: pętla delete+insert zasypuje kolejkę admina.
    const { data: poKasowaniu } = await uczestnikClient
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

  it("pokazuje uczestnikowi jego własne zgłoszenie", async () => {
    const { error: bladZapisu } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));
    expect(bladZapisu).toBeNull();

    // Na tym odczycie stoi cały ekran /rejestracja: to on decyduje, czy pokazać
    // poczekalnię, formularz, czy notatkę o odrzuceniu. Bez testu ten człon
    // polityki mógłby wypaść niezauważony.
    const { data } = await uczestnikClient.from("registrations").select("id, status");

    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("pending");
  });
});

// Zabezpieczenia z migracji 20260915120200_hartowanie_bramy.sql.
describe("hartowanie bramy", () => {
  it("nie pozwala złożyć drugiego zgłoszenia, póki pierwsze czeka", async () => {
    const pierwsze = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));
    expect(pierwsze.error).toBeNull();

    // Bez unikalnego indeksu częściowego pętla insertów z konsoli zasypałaby
    // kolejkę admina, gdzie każdy wiersz kosztuje osobne createSignedUrl.
    const drugie = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));
    expect(drugie.error).not.toBeNull();
  });

  it("nie pozwala wskazać ścieżki wychodzącej z własnego folderu", async () => {
    const obcy = await nowyUzytkownik("sasiad");

    // `like 'uuid/%'` sam w sobie to przepuszcza, a klient Storage normalizuje
    // `..` przy budowaniu URL-a — czyli trafiłoby na cudzy plik.
    const { error } = await uczestnikClient.from("registrations").insert({
      ...zgloszenieDla(uczestnik),
      proof_path: `${uczestnik.id}/../${obcy.id}/dowod.jpg`,
    });

    expect(error).not.toBeNull();
  });

  it("nie pozwala złożyć zgłoszenia osobie już zaakceptowanej", async () => {
    await ustawJakoZaakceptowany(uczestnik);

    // Inaczej odrzucenie takiego zgłoszenia zbiłoby jej status na 'rejected'
    // i wyrzuciło ją z aplikacji, mimo że była już w drużynie.
    const { error } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));

    expect(error).not.toBeNull();
  });

  it("odrzuca pewność OCR spoza zakresu 0-1", async () => {
    const { error } = await uczestnikClient
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), ocr_confidence: 5 });

    expect(error).not.toBeNull();
  });

  it("pozwala złożyć zgłoszenie ponownie po odrzuceniu", async () => {
    const { data: pierwsze, error: bladZapisu } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik))
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
    const { error } = await uczestnikClient
      .from("registrations")
      .insert(zgloszenieDla(uczestnik));

    expect(error).toBeNull();

    const { data: wszystkie } = await admin
      .from("registrations")
      .select("status")
      .eq("user_id", uczestnik.id);
    expect(wszystkie).toHaveLength(2);
  });

  it("odrzuca liczbę trafionych słów spoza zakresu 0-6", async () => {
    const { error } = await uczestnikClient
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), ocr_keywords_hit: 99 });

    expect(error).not.toBeNull();
  });

  it("odrzuca nadmiarowo długi tekst OCR", async () => {
    // Tekst OCR pochodzi od niezaufanego klienta. Bez limitu jedno zgłoszenie
    // mogłoby wepchnąć megabajt znaków do bazy na darmowym planie.
    const { error } = await uczestnikClient
      .from("registrations")
      .insert({ ...zgloszenieDla(uczestnik), ocr_text: "a".repeat(20_001) });

    expect(error).not.toBeNull();
  });
});
