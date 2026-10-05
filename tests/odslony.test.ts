import { describe, it, expect } from "vitest";
import { czyOdsloniete, miastoZAdresu, kiedyOdslona, tekstOdliczania } from "../src/lib/odslony";
import { REGULAMIN, regulaminDoWyswietlenia } from "../src/lib/regulamin";

const P = "2099-01-01T12:00:00+01:00";
const W = "2020-01-01T12:00:00+01:00";
const teraz = new Date("2026-10-01T12:00:00+02:00");

describe("czyOdsloniete - lustro reguły z bazy", () => {
  it("własna data decyduje, gdy zapisy przed nami", () => {
    expect(czyOdsloniete({ osrodek: W, cena: P, zapisy: P, plan: P, infopack: P }, "osrodek", teraz)).toBe(true);
    expect(czyOdsloniete({ osrodek: W, cena: P, zapisy: P, plan: P, infopack: P }, "cena", teraz)).toBe(false);
  });
  it("odsłona zapisów odsłania wszystko", () => {
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: W, plan: P, infopack: P }, "cena", teraz)).toBe(true);
  });
  it("plan nie odsłania się z zapisami", () => {
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: W, plan: P, infopack: P }, "plan", teraz)).toBe(false);
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: P, plan: W, infopack: P }, "plan", teraz)).toBe(true);
  });
  it("infopack ma własny termin, niezależny od zapisów i planu", () => {
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: W, plan: W, infopack: P }, "infopack", teraz)).toBe(false);
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: P, plan: P, infopack: W }, "infopack", teraz)).toBe(true);
  });
  it("pusta data znaczy odsłonięte", () => {
    expect(czyOdsloniete({ osrodek: null, cena: P, zapisy: P, plan: P, infopack: P }, "osrodek", teraz)).toBe(true);
    expect(czyOdsloniete({ osrodek: P, cena: P, zapisy: null, plan: P, infopack: P }, "osrodek", teraz)).toBe(true);
  });
});

describe("teksty", () => {
  it("miasto z adresu po kodzie pocztowym", () => {
    expect(miastoZAdresu("Poznańska 5, 58-540 Karpacz")).toBe("Karpacz");
    expect(miastoZAdresu("ul. Długa 1, 00-001 Nowa Wieś")).toBe("Nowa Wieś");
    expect(miastoZAdresu(null)).toBeNull();
    expect(miastoZAdresu("bez kodu")).toBeNull();
  });
  it("kiedy odsłona - po polsku, w strefie warszawskiej", () => {
    expect(kiedyOdslona("2026-10-05T16:00:00+00:00")).toBe("5 października o 18:00");
    expect(kiedyOdslona(null)).toBe("wkrótce");
  });
  it("odliczanie w skrócie", () => {
    expect(tekstOdliczania({ minelo: false, dni: 3, godziny: 4, minuty: 5, sekundy: 6 })).toBe("3 d 04:05:06");
    expect(tekstOdliczania({ minelo: true, dni: 0, godziny: 0, minuty: 0, sekundy: 0 })).toBe("za chwilę");
  });
});

describe("regulamin przed odsłoną ośrodka", () => {
  it("§ 1 ust. 3 bez nazwy, adresu i miasta; reszta bez zmian", () => {
    const zakryty = regulaminDoWyswietlenia(false);
    const ust3 = zakryty[0].ustepy[2];
    expect(ust3).not.toMatch(/Karpacz|Zielone|Poznańsk/);
    expect(ust3).toMatch(/ogłosi przed rozpoczęciem zapisów/);
    expect(zakryty[0].ustepy[0]).toBe(REGULAMIN[0].ustepy[0]);
    expect(zakryty.slice(1)).toEqual(REGULAMIN.slice(1));
  });
  it("po odsłonie pełna treść", () => {
    expect(regulaminDoWyswietlenia(true)).toBe(REGULAMIN);
  });
});
