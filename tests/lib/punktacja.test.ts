import { describe, it, expect } from "vitest";
import { PUNKTACJA, powodPunktacji, punktyDoWpisania } from "@/lib/punktacja";

const gra = PUNKTACJA.find((s) => s.sekcja === "Gra terenowa")!;
const poz = (nazwa: string) => gra.pozycje.find((p) => p.nazwa === nazwa)!;

describe("punktacja gry terenowej (Mikołaj 2026-10-22)", () => {
  it("zwykła stacja i trasa liczą się same", () => {
    expect(poz("Jedna stacja")).toMatchObject({ punkty: 15, automat: true });
    expect(poz("Pełna trasa")).toMatchObject({ punkty: 300, automat: true });
  });

  it("wersja „cała drużyna” jest ręczna, a panel wpisuje tylko różnicę", () => {
    expect(poz("Jedna stacja - cała drużyna").automat).toBeUndefined();
    expect(punktyDoWpisania(poz("Jedna stacja - cała drużyna"))).toBe(15);
    expect(punktyDoWpisania(poz("Pełna trasa - cała drużyna"))).toBe(150);
    expect(powodPunktacji("Gra terenowa", poz("Pełna trasa - cała drużyna"))).toBe(
      "Gra terenowa: Pełna trasa - cała drużyna (dopłata)",
    );
  });

  it("zwykła pozycja ręczna wpisuje pełną wartość", () => {
    const sp = PUNKTACJA.find((s) => s.sekcja === "Ujemne punkty")!.pozycje.find((p) => p.nazwa === "Spóźnienie się")!;
    expect(punktyDoWpisania(sp)).toBe(-10);
  });
});
