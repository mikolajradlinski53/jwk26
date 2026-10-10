import { describe, it, expect } from "vitest";
import { czekaNaOtwarcie } from "../src/lib/poczekalnia";

const teraz = new Date("2026-10-12T12:00:00+02:00");
const przyjety = { rola: "user", status: "approved", teraz };

describe("czekaNaOtwarcie", () => {
  it("przyjęty czeka do godziny otwarcia", () => {
    expect(czekaNaOtwarcie({ ...przyjety, otwarcie: "2026-10-12T18:00:00+02:00" })).toBe(true);
  });

  it("po godzinie otwarcia wchodzi", () => {
    expect(czekaNaOtwarcie({ ...przyjety, otwarcie: "2026-10-12T11:59:59+02:00" })).toBe(false);
  });

  it("puste albo nieczytelne otwarcie = platforma otwarta", () => {
    for (const otwarcie of ["", null, undefined, "jutro", 5]) {
      expect(czekaNaOtwarcie({ ...przyjety, otwarcie }), String(otwarcie)).toBe(false);
    }
  });

  it("admin wchodzi zawsze", () => {
    expect(
      czekaNaOtwarcie({ ...przyjety, rola: "admin", otwarcie: "2026-10-20T12:00:00+02:00" }),
    ).toBe(false);
  });

  it("nieprzyjętego obsługuje brama formularza, nie poczekalnia", () => {
    expect(
      czekaNaOtwarcie({ ...przyjety, status: "pending", otwarcie: "2026-10-20T12:00:00+02:00" }),
    ).toBe(false);
  });
});
