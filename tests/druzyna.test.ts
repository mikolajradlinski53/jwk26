import { describe, it, expect } from "vitest";
import { bladNazwy } from "../src/lib/druzyna";
import { komunikat } from "../src/lib/zapisy/bledy";

describe("walidacja nazwy drużyny (lustro bazy)", () => {
  it("pusta i za długa nazwa, za długie motto", () => {
    expect(bladNazwy("   ", "")).toMatch(/nazwę/);
    expect(bladNazwy("x".repeat(31), "")).toMatch(/30/);
    expect(bladNazwy("Ok", "m".repeat(61))).toMatch(/60/);
    expect(bladNazwy(" Zakon ", "")).toBeNull();
  });
  it("błędy z bazy po ludzku", () => {
    expect(komunikat({ message: "NAZWA_ZAJETA" })).toMatch(/zajęta/);
    expect(komunikat({ message: "NAZWA_JUZ_NADANA" })).toMatch(/już ma nazwę/);
    expect(komunikat({ message: "Glosowanie nie trwa" })).toMatch(/nie trwa/);
    expect(komunikat({ message: "Nazwe nadaje kapitan druzyny" })).toMatch(/kapitan drużyny/);
  });
});
