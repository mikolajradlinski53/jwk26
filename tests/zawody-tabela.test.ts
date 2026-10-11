import { describe, it, expect } from "vitest";
import { tabela, komunikatZawodow, type Mecz } from "../src/lib/zawody";

const d = [
  { id: "a", nazwa: "Kozy" },
  { id: "b", nazwa: "Smoki" },
  { id: "c", nazwa: "Żaby" },
];
const m = (a: string, b: string, wa: number | null, wb: number | null): Mecz => ({
  id: a + b, zawody_id: "z", runda: 1, druzyna_a: a, druzyna_b: b, wynik_a: wa, wynik_b: wb,
});

describe("tabela", () => {
  it("3 za wygraną, 1 za remis, mecze bez wyniku się nie liczą", () => {
    const t = tabela(d, [m("a", "b", 2, 0), m("b", "c", 1, 1), m("a", "c", null, null)]);
    expect(t.map((w) => [w.nazwa, w.punkty, w.mecze])).toEqual([
      ["Kozy", 3, 1],
      ["Żaby", 1, 1],
      ["Smoki", 1, 2],
    ]);
  });

  it("przy równych punktach decyduje różnica, potem zdobyte", () => {
    const t = tabela(d, [m("a", "c", 5, 0), m("b", "c", 2, 1), m("a", "b", 1, 1)]);
    // Kozy i Smoki po 4 pkt; Kozy +4, Smoki +1.
    expect(t.map((w) => [w.nazwa, w.punkty])).toEqual([
      ["Kozy", 4],
      ["Smoki", 4],
      ["Żaby", 0],
    ]);
  });

  it("pusta tabela przed meczami - alfabetycznie", () => {
    expect(tabela(d, []).map((w) => w.nazwa)).toEqual(["Kozy", "Smoki", "Żaby"]);
  });
});

describe("komunikatZawodow", () => {
  it("podaje ksywki zajętych i rozmiar składu", () => {
    expect(komunikatZawodow({ message: "SKLAD_ZAJETY: Gracz 1, Gracz 4" })).toBe("Już w innym składzie: Gracz 1, Gracz 4.");
    expect(komunikatZawodow({ message: "SKLAD_ROZMIAR: sklad liczy 5 osob razem z Toba" })).toBe(
      "Skład liczy dokładnie 5 osób razem z Tobą.",
    );
  });
});
