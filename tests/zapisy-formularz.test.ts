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

describe("zwolnienie rektorskie i alkohol", () => {
  const zwolnienie = { ...pelne, zwolnienie: true, zwolnienieOd: "12:30", zwolnienieDo: "16:00" };

  it("zwolnienie w przedziale 12:00-18:00 co pół godziny przechodzi", () => {
    expect(waliduj("oTobie", zwolnienie, JWK)).toEqual({});
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieOd: "12:00", zwolnienieDo: "18:00" }, JWK),
    ).toEqual({});
  });

  it("zwolnienie bez godzin, odwrócone albo poza przedziałem nie przechodzi", () => {
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieOd: "", zwolnienieDo: "" }, JWK).zwolnienieOd,
    ).toBeDefined();
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieOd: "16:00", zwolnienieDo: "16:00" }, JWK)
        .zwolnienieDo,
    ).toBeDefined();
    // Wyjazd rusza o 12:00 - wcześniejsza godzina nie ma sensu, nawet wpisana ręcznie.
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieOd: "11:30" }, JWK).zwolnienieOd,
    ).toBeDefined();
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieDo: "18:30" }, JWK).zwolnienieDo,
    ).toBeDefined();
  });

  it("Alumni nie podają zwolnienia - pole nie idzie do bazy", () => {
    const alumn = { ...zwolnienie, pula: "alumni" as const, zwolnienieOd: "", zwolnienieDo: "" };
    expect(waliduj("oTobie", alumn, JWK)).toEqual({});
    expect(doRpc({ ...zwolnienie, pula: "alumni" }).p_dane).toMatchObject({
      zwolnienie_od: null,
      zwolnienie_do: null,
    });
  });

  it("zwolnienie i alkohol trafiają do wywołania, brak odpowiedzi jako null", () => {
    expect(doRpc({ ...zwolnienie, alkohol: "czasami" }).p_dane).toMatchObject({
      zwolnienie_od: "12:30",
      zwolnienie_do: "16:00",
      alkohol: "czasami",
    });
    // Odznaczone zwolnienie nie wysyła godzin, nawet jeśli wybrano je wcześniej.
    expect(doRpc({ ...zwolnienie, zwolnienie: false }).p_dane).toMatchObject({
      zwolnienie_od: null,
      zwolnienie_do: null,
      alkohol: null,
    });
  });
});

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

  it("data urodzenia sprzed 1900 roku jest odrzucana, sam 1900-01-01 przechodzi", () => {
    expect(
      waliduj("dane", { ...pelne, dataUrodzenia: "1899-12-31" }, JWK).dataUrodzenia,
    ).toBe("Podaj datę urodzenia");
    expect(waliduj("dane", { ...pelne, dataUrodzenia: "1900-01-01" }, JWK)).toEqual({});
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

    const ice = { ...pelne, iceImie: "Anna", iceRelacja: "mama", iceTelefon: "600200300" };
    expect(waliduj("ice", ice, JWK).icePoinformowany).toBeDefined();
    expect(waliduj("ice", { ...ice, icePoinformowany: true }, JWK)).toEqual({});
  });

  it("ICE wymaga informacji, kim ta osoba jest dla uczestnika", () => {
    // W nagłym wypadku „dzwonię do Anny" nic nie mówi - „dzwonię do mamy" tak.
    const bezRelacji = {
      ...pelne,
      iceImie: "Anna",
      iceTelefon: "600200300",
      icePoinformowany: true,
    };
    expect(waliduj("ice", bezRelacji, JWK).iceRelacja).toBeDefined();
    // Sama relacja też uruchamia ICE - nie da się jej zostawić bez numeru.
    expect(waliduj("ice", { ...pelne, iceRelacja: "tata" }, JWK).iceTelefon).toBeDefined();
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
      iceImie: "Anna",
      iceRelacja: " mama ",
      iceTelefon: "600200300",
      icePoinformowany: true,
    });
    expect(p_wrazliwe).toEqual({
      ice_imie: "Anna",
      ice_relacja: "mama",
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
    expect(komunikat({ message: "PRZELEW_WYMAGANY" })).toMatch(/dołącz potwierdzenie/);
    expect(komunikat(new TypeError("Load failed"))).toMatch(/połączenie/);
  });
});
