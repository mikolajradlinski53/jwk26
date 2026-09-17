import { describe, it, expect } from "vitest";
import { odliczanie } from "../src/lib/odliczanie";

const JWK = "2026-10-23T18:00:00+02:00";

describe("odliczanie", () => {
  it("liczy pełne doby do daty w przyszłości", () => {
    const w = odliczanie(JWK, new Date("2026-10-20T18:00:00+02:00"));
    expect(w.minelo).toBe(false);
    expect(w.dni).toBe(3);
    expect(w.godziny).toBe(0);
  });

  it("nie pokazuje wartości ujemnych po terminie", () => {
    const w = odliczanie(JWK, new Date("2026-10-24T18:00:00+02:00"));
    expect(w.minelo).toBe(true);
    expect(w.dni).toBe(0);
    expect(w.godziny).toBe(0);
  });

  it("liczy względem Warszawy, nie strefy przeglądarki", () => {
    // Ta sama chwila zapisana w UTC musi dać ten sam wynik.
    const a = odliczanie(JWK, new Date("2026-10-22T16:00:00Z"));
    const b = odliczanie(JWK, new Date("2026-10-22T18:00:00+02:00"));
    expect(a).toEqual(b);
  });

  it("zwraca stan miniony dla pustej daty", () => {
    const w = odliczanie(null, new Date());
    expect(w.minelo).toBe(true);
  });
});
