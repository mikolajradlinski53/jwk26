import { describe, it, expect } from "vitest";
import {
  progPelnoletnosci,
  komunikatWieku,
  waliduj,
  doRpc,
  kroki,
  PUSTY_FORMULARZ,
  type DaneFormularza,
} from "../src/lib/zapisy/formularz";
import { KONTAKT_IOD, WERSJA_ZGOD } from "../src/lib/zapisy/zgody";
import { komunikat } from "../src/lib/zapisy/bledy";

const JWK = "2026-10-23T18:00:00+02:00";

// Formularz, który przechodzi każdy krok. Testy psują w nim jedno pole naraz,
// żeby porażka wskazywała dokładnie jedną regułę.
const pelne: DaneFormularza = {
  ...PUSTY_FORMULARZ,
  pula: "dzialacze",
  akceptujeKlauzule: true,
  akceptujeRegulamin: true,
  akceptujeSzkody: true,
  imie: "Ala",
  nazwisko: "Kot",
  nrIndeksu: "123456",
  dataUrodzenia: "2000-01-01",
  telefon: "600 100 200",
  dojazd: "autokar_oba",
  ksywka: "Kotka",
};

describe("próg pełnoletności", () => {
  it("to dzień wyjazdu osiemnaście lat wcześniej", () => {
    expect(progPelnoletnosci(JWK)).toBe("2008-10-23");
  });

  it("liczy dzień w strefie warszawskiej, nie w UTC", () => {
    // 00:30 w Warszawie to jeszcze 22 października w UTC. Liczenie w UTC
    // przesunęłoby próg o dzień i wpuściło osobę o dzień za młodą.
    expect(progPelnoletnosci("2026-10-23T00:30:00+02:00")).toBe("2008-10-23");
  });

  it("komunikat podaje datę wyjazdu słownie", () => {
    expect(komunikatWieku(JWK)).toContain("23 października 2026");
  });
});

describe("walidacja kroków", () => {
  it("urodzony w dniu progu przechodzi, dzień później nie", () => {
    expect(waliduj("dane", { ...pelne, dataUrodzenia: "2008-10-23" }, JWK)).toEqual({});
    expect(
      waliduj("dane", { ...pelne, dataUrodzenia: "2008-10-24" }, JWK).dataUrodzenia,
    ).toBe(komunikatWieku(JWK));
  });

  it("numer indeksu jest opcjonalny tylko w puli Alumni", () => {
    const bezIndeksu = { ...pelne, nrIndeksu: "" };
    expect(waliduj("dane", bezIndeksu, JWK).nrIndeksu).toBeDefined();
    expect(waliduj("dane", { ...bezIndeksu, pula: "alumni" }, JWK)).toEqual({});
    // Alumn, który jednak wpisze indeks, wpisuje go poprawnie.
    expect(
      waliduj("dane", { ...pelne, pula: "alumni", nrIndeksu: "abc" }, JWK).nrIndeksu,
    ).toBeDefined();
  });

  it("puste ICE przechodzi, wypełnione wymaga potwierdzenia", () => {
    expect(waliduj("ice", pelne, JWK)).toEqual({});

    const ice = { ...pelne, iceImie: "Mama", iceTelefon: "600200300" };
    expect(waliduj("ice", ice, JWK).icePoinformowany).toBeDefined();
    expect(waliduj("ice", { ...ice, icePoinformowany: true }, JWK)).toEqual({});
  });

  it("dane zdrowotne bez zgody nie przechodzą", () => {
    expect(waliduj("zdrowie", pelne, JWK)).toEqual({});
    const dieta = { ...pelne, dieta: "wegetariańska" };
    expect(waliduj("zdrowie", dieta, JWK).zgodaArt9).toBeDefined();
    expect(waliduj("zdrowie", { ...dieta, zgodaArt9: true }, JWK)).toEqual({});
  });

  it("zasady wymagają trzech akceptacji, ale nie zgody na wizerunek", () => {
    expect(waliduj("zasady", { ...pelne, zgodaWizerunek: false }, JWK)).toEqual({});
    expect(
      Object.keys(waliduj("zasady", { ...PUSTY_FORMULARZ }, JWK)).sort(),
    ).toEqual(["akceptujeKlauzule", "akceptujeRegulamin", "akceptujeSzkody"]);
  });

  it("krok O tobie wymaga dojazdu i ksywki do 24 znaków", () => {
    expect(waliduj("oTobie", pelne, JWK)).toEqual({});
    expect(waliduj("oTobie", { ...pelne, dojazd: "" }, JWK).dojazd).toBeDefined();
    expect(
      waliduj("oTobie", { ...pelne, ksywka: "x".repeat(25) }, JWK).ksywka,
    ).toBeDefined();
  });
});

describe("mapowanie na wywołanie funkcji", () => {
  it("puste pola dobrowolne idą jako null, bez ICE i zdrowia nie ma danych wrażliwych", () => {
    const { p_dane, p_wrazliwe } = doRpc(pelne);
    expect(p_wrazliwe).toBeNull();
    expect(p_dane.piosenka).toBeNull();
    expect(p_dane.uwagi).toBeNull();
    expect(p_dane.wersja_zgod).toBe(WERSJA_ZGOD);
    expect(p_dane.telefon).toBe("600 100 200");
  });

  it("dane zdrowotne niosą zgodę, a ICE potwierdzenie", () => {
    const { p_wrazliwe } = doRpc({
      ...pelne,
      alergie: " orzechy ",
      zgodaArt9: true,
      iceImie: "Mama",
      iceTelefon: "600200300",
      icePoinformowany: true,
    });
    expect(p_wrazliwe).toEqual({
      ice_imie: "Mama",
      ice_telefon: "600200300",
      ice_poinformowany: true,
      dieta: null,
      alergie: "orzechy",
      choroby_leki: null,
      zgoda_art9: true,
    });
  });

  it("rezerwa nie ma kroku przelewu", () => {
    expect(kroki(true)).not.toContain("przelew");
    expect(kroki(false).at(-1)).toBe("przelew");
  });
});

describe("zgody i komunikaty", () => {
  it("klauzula ma adres kontaktowy do IOD", () => {
    expect(KONTAKT_IOD).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });

  it("kody z bazy dostają własne zdania", () => {
    // Kształt PostgrestError: obiekt z `message`, niekoniecznie instancja Error.
    expect(komunikat({ message: "PULA_PELNA" })).toMatch(/zapełniła/);
    expect(komunikat({ message: "NIEPELNOLETNI" })).toMatch(/18 lat/);
    expect(
      komunikat({ message: 'duplicate key value violates unique constraint "registrations_one_pending_idx"' }),
    ).toMatch(/czeka na rozpatrzenie/);
    expect(komunikat(new Error("cos zupelnie innego"))).toMatch(/Spróbuj jeszcze raz/);
  });
});
