import { describe, it, expect } from "vitest";
import { bezOgonkow, trafioneSlowa, SLOWA_KLUCZOWE } from "@/lib/ocr/score";

describe("bezOgonkow", () => {
  it("sprowadza polskie znaki do łacińskich", () => {
    expect(bezOgonkow("tytuł przelewu ŁÓDŹ")).toBe("tytul przelewu LODZ");
  });

  it("zostawia tekst bez ogonków bez zmian", () => {
    expect(bezOgonkow("IBAN PL61")).toBe("IBAN PL61");
  });
});

describe("trafioneSlowa", () => {
  it("znajduje słowa niezależnie od wielkości liter i ogonków", () => {
    const tekst = "Potwierdzenie PRZELEWU\nTytuł: wyjazd\nKwota 350,00 PLN";
    expect(trafioneSlowa(tekst).sort()).toEqual(
      ["kwota", "pln", "przelew", "tytul"].sort(),
    );
  });

  it("zwraca pustą listę dla tekstu bez związku z przelewem", () => {
    expect(trafioneSlowa("zdjęcie kota na parapecie")).toEqual([]);
  });

  it("zwraca pustą listę dla pustego tekstu", () => {
    expect(trafioneSlowa("")).toEqual([]);
  });

  it("nie zgłasza trafień spoza listy", () => {
    for (const slowo of trafioneSlowa("przelew iban kwota pln tytul odbiorca")) {
      expect(SLOWA_KLUCZOWE).toContain(slowo);
    }
  });
});
