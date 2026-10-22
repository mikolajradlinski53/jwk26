import { describe, it, expect } from "vitest";
import { komunikatLicytacji, minimalnaOferta } from "@/lib/licytacje";

describe("minimalnaOferta", () => {
  it("bez ofert - cena wywoławcza", () => {
    expect(minimalnaOferta({ najwyzsza: null, cena_wywolawcza: 80 }, 10)).toBe(80);
  });
  it("z ofertą - najwyższa plus krok", () => {
    expect(minimalnaOferta({ najwyzsza: 100, cena_wywolawcza: 80 }, 10)).toBe(110);
  });
});

describe("komunikatLicytacji", () => {
  it.each([
    ["ZA_MALO", "Ktoś Was uprzedził albo kwota za mała. Odśwież."],
    ["JUZ_PROWADZICIE", "Prowadzicie - nie przebijacie samych siebie."],
    ["BRAK_PUNKTOW", "Za mało wolnych punktów (część trzymają Wasze prowadzące oferty)."],
    ["LICYTACJA_NIEAKTYWNA", "Licytacja jest zamknięta albo jeszcze się nie zaczęła."],
    ["NIE_KAPITAN", "Licytuje kapitan drużyny."],
    ["coś innego", "Coś poszło nie tak. Spróbuj jeszcze raz."],
  ])("%s", (kod, tekst) => {
    expect(komunikatLicytacji({ message: kod })).toBe(tekst);
  });
});
