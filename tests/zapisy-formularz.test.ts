import { describe, it, expect } from "vitest";
import {
  progPelnoletnosci,
  komunikatWieku,
  maskaDaty,
  dataZMaski,
  wartoscPolaDaty,
  wyswietlDate,
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
  const zwolnienie = { ...pelne, zwolnienie: true, zwolnienieSloty: ["13:15-14:45"] };

  it("jeden albo kilka przedziałów z listy przechodzi", () => {
    expect(waliduj("oTobie", zwolnienie, JWK)).toEqual({});
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieSloty: ["11:30-13:00", "17:30-19:00"] }, JWK),
    ).toEqual({});
  });

  it("zaznaczone zwolnienie bez przedziału albo z nieznanym przedziałem nie przechodzi", () => {
    expect(waliduj("oTobie", { ...zwolnienie, zwolnienieSloty: [] }, JWK).zwolnienieSloty).toMatch(
      /co najmniej jeden/,
    );
    expect(
      waliduj("oTobie", { ...zwolnienie, zwolnienieSloty: ["12:00-18:00"] }, JWK).zwolnienieSloty,
    ).toBeDefined();
  });

  it("Alumni nie podają zwolnienia - pole nie idzie do bazy", () => {
    const alumn = { ...zwolnienie, pula: "alumni" as const, zwolnienieSloty: [] };
    expect(waliduj("oTobie", alumn, JWK)).toEqual({});
    expect(doRpc({ ...zwolnienie, pula: "alumni" }).p_dane).toMatchObject({ zwolnienie_sloty: null });
  });

  it("przedziały w kolejności z listy, bez duplikatów; stare pola od-do nie idą do bazy", () => {
    const p = doRpc({
      ...zwolnienie,
      zwolnienieSloty: ["17:30-19:00", "11:30-13:00", "17:30-19:00"],
      alkohol: "czasami",
    }).p_dane;
    expect(p).toMatchObject({ zwolnienie_sloty: ["11:30-13:00", "17:30-19:00"], alkohol: "czasami" });
    expect(p).not.toHaveProperty("zwolnienie_od");
    expect(p).not.toHaveProperty("zwolnienie_do");
    // Odznaczone zwolnienie nie wysyła przedziałów, nawet jeśli wybrano je wcześniej.
    expect(doRpc({ ...zwolnienie, zwolnienie: false }).p_dane).toMatchObject({
      zwolnienie_sloty: null,
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
    ).toBe("Sprawdź rok urodzenia");
    expect(waliduj("dane", { ...pelne, dataUrodzenia: "1900-01-01" }, JWK)).toEqual({});
  });

  it("pusta, niepełna i nieistniejąca data mają osobne komunikaty", () => {
    const blad = (d: string) => waliduj("dane", { ...pelne, dataUrodzenia: d }, JWK).dataUrodzenia;
    expect(blad("")).toBe("Podaj datę urodzenia");
    expect(blad("15.03")).toMatch(/pełną datę/);
    expect(blad("31.02.2004")).toMatch(/Nie ma takiej daty/);
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

describe("data urodzenia wpisywana jako DD.MM.RRRR", () => {
  it("maska wstawia kropki między grupami, nigdy na końcu", () => {
    expect(maskaDaty("15032004")).toBe("15.03.2004");
    expect(maskaDaty("1")).toBe("1");
    expect(maskaDaty("15")).toBe("15");
    expect(maskaDaty("150")).toBe("15.0");
    expect(maskaDaty("1503")).toBe("15.03");
    // Wklejone z kreskami, spacjami albo za długie - liczą się cyfry, najwyżej 8.
    expect(maskaDaty("15-03-2004")).toBe("15.03.2004");
    expect(maskaDaty("15 03 2004 12")).toBe("15.03.2004");
    expect(maskaDaty("")).toBe("");
  });

  it("tylko pełna, istniejąca data zamienia się na RRRR-MM-DD", () => {
    expect(dataZMaski("15.03.2004")).toBe("2004-03-15");
    expect(dataZMaski("29.02.2004")).toBe("2004-02-29");
    expect(dataZMaski("29.02.2005")).toBeNull();
    expect(dataZMaski("31.04.2004")).toBeNull();
    expect(dataZMaski("00.01.2004")).toBeNull();
    expect(dataZMaski("15.13.2004")).toBeNull();
    expect(dataZMaski("15.03.20")).toBeNull();
  });

  it("pole trzyma RRRR-MM-DD po pełnym wpisie, a do tego czasu wpis z maską", () => {
    expect(wartoscPolaDaty("15032004")).toBe("2004-03-15");
    expect(wartoscPolaDaty("1503")).toBe("15.03");
    expect(wartoscPolaDaty("31022004")).toBe("31.02.2004");
    expect(wyswietlDate("2004-03-15")).toBe("15.03.2004");
    expect(wyswietlDate("15.03")).toBe("15.03");
    expect(wyswietlDate("")).toBe("");
  });

  it("kasowanie z pełnej daty nie zakleszcza się na kropce", () => {
    // Pole pokazuje 15.03.2004; Backspace pięć razy zostawia „15.03” itd.
    expect(wartoscPolaDaty("15.03.200")).toBe("15.03.200");
    expect(wartoscPolaDaty("15.03.")).toBe("15.03");
    expect(wartoscPolaDaty("15.0")).toBe("15.0");
    expect(wartoscPolaDaty("15.")).toBe("15");
  });
});
