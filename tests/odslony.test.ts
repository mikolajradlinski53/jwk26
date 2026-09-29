import { describe, it, expect } from "vitest";
import { czyOdsloniete, miastoZAdresu, kiedyOdslona, tekstOdliczania } from "../src/lib/odslony";

const P = "2099-01-01T12:00:00+01:00";
const W = "2020-01-01T12:00:00+01:00";
const teraz = new Date("2026-10-01T12:00:00+02:00");

describe("czyOdsloniete — lustro reguły z bazy", () => {
  it("własna data decyduje, gdy zapisy przed nami", () => {
    expect(czyOdsloniete({ osrodek: W, cena: P, zapisy: P }, "osrodek", teraz)).toBe(true);
    expect(czyOdsloniete({ osrodek: W, cena: P, zapisy: P }, "cena", teraz)).toBe(false);
  });
  it("odsłona zapisów odsłania wszystko", () => {
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: W }, "cena", teraz)).toBe(true);
  });
  it("pusta data znaczy odsłonięte", () => {
    expect(czyOdsloniete({ osrodek: null, cena: P, zapisy: P }, "osrodek", teraz)).toBe(true);
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: null }, "osrodek", teraz)).toBe(true);
  });
});

describe("teksty", () => {
  it("miasto z adresu po kodzie pocztowym", () => {
    expect(miastoZAdresu("Poznańska 5, 58-540 Karpacz")).toBe("Karpacz");
    expect(miastoZAdresu("ul. Długa 1, 00-001 Nowa Wieś")).toBe("Nowa Wieś");
    expect(miastoZAdresu(null)).toBeNull();
    expect(miastoZAdresu("bez kodu")).toBeNull();
  });
  it("kiedy odsłona — po polsku, w strefie warszawskiej", () => {
    expect(kiedyOdslona("2026-10-05T16:00:00+00:00")).toBe("5 października o 18:00");
    expect(kiedyOdslona(null)).toBe("wkrótce");
  });
  it("odliczanie w skrócie", () => {
    expect(tekstOdliczania({ minelo: false, dni: 3, godziny: 4, minuty: 5, sekundy: 6 })).toBe("3 d 04:05:06");
    expect(tekstOdliczania({ minelo: true, dni: 0, godziny: 0, minuty: 0, sekundy: 0 })).toBe("za chwilę");
  });
});
