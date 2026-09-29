import { describe, it, expect } from "vitest";
import {
  aktywnaTrasa,
  czyWskazuje,
  kierunek,
  klatkaChodu,
  polozenieX,
  postepTrasy,
  ulamekDrogi,
} from "../src/app/landing/zaba/ruch";

describe("postęp trasy", () => {
  it("0 przy wejściu dzielnika w okno, 1 przy wyjściu, pośrodku liniowo", () => {
    expect(postepTrasy(850, 1000)).toBe(0);
    expect(postepTrasy(150, 1000)).toBe(1);
    expect(postepTrasy(500, 1000)).toBeCloseTo(0.5);
    expect(postepTrasy(2000, 1000)).toBe(0);
    expect(postepTrasy(-500, 1000)).toBe(1);
  });
});

describe("droga i położenie", () => {
  it("zwykła trasa: ułamek drogi równy postępowi", () => {
    expect(ulamekDrogi(0.3, false)).toBe(0.3);
  });
  it("trasa ze wskazywaniem: postój na środku w przedziale 0,45–0,6", () => {
    expect(ulamekDrogi(0.45, true)).toBeCloseTo(0.5);
    expect(ulamekDrogi(0.52, true)).toBe(0.5);
    expect(ulamekDrogi(0.6, true)).toBeCloseTo(0.5);
    expect(ulamekDrogi(1, true)).toBeCloseTo(1);
    expect(czyWskazuje(0.5, true)).toBe(true);
    expect(czyWskazuje(0.5, false)).toBe(false);
    expect(czyWskazuje(0.7, true)).toBe(false);
  });
  it("żaba zaczyna schowana z lewej i kończy schowana z prawej", () => {
    expect(polozenieX(0, 400, 80)).toBe(-80);
    expect(polozenieX(1, 400, 80)).toBe(400);
  });
});

describe("chód", () => {
  it("klatka zależy od drogi, nie od czasu — ta sama droga, ta sama klatka", () => {
    expect(klatkaChodu(0, 14, 8)).toBe(0);
    expect(klatkaChodu(15, 14, 8)).toBe(1);
    expect(klatkaChodu(14 * 8 + 1, 14, 8)).toBe(0);
    expect(klatkaChodu(-15, 14, 8)).toBe(1);
  });
  it("kierunek z ruchu; bez ruchu zostaje poprzedni", () => {
    expect(kierunek(3, -1)).toBe(1);
    expect(kierunek(-3, 1)).toBe(-1);
    expect(kierunek(0.1, -1)).toBe(-1);
  });
});

describe("aktywna trasa", () => {
  it("tylko trasy w trakcie przejścia, najbliższa środka okna", () => {
    const trasy = [
      { gora: -300, dol: -250 }, // już za górą
      { gora: 300, dol: 340 },
      { gora: 480, dol: 520 },
      { gora: 1200, dol: 1240 }, // jeszcze pod oknem
    ];
    expect(aktywnaTrasa(trasy, 1000)).toBe(2);
    expect(aktywnaTrasa([{ gora: 1200, dol: 1240 }], 1000)).toBe(-1);
  });
});
