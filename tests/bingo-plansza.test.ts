import { describe, it, expect } from "vitest";
import { klasaTytuluPola } from "../src/lib/bingo";

describe("rozmiar tytułu w polu bingo", () => {
  it("krótkie wyrazy - zwykły rozmiar, bez łamania w środku", () => {
    expect(klasaTytuluPola("Uczta")).toBe("text-[0.6rem]");
    expect(klasaTytuluPola("Zrób zdjęcie całej drużyny na tle ośrodka")).toBe("text-[0.6rem]");
  });
  it("dłuższy wyraz - mniejsza czcionka zamiast „Odtworzeni-e”", () => {
    expect(klasaTytuluPola("Odtworzenie")).toBe("text-[0.53rem]");
    expect(klasaTytuluPola("Nauka bezużyteczna")).toBe("text-[0.47rem]");
  });
  it("wyraz-potwór łamie się gdziekolwiek", () => {
    expect(klasaTytuluPola("Konstantynopolitańczykowianeczka")).toContain("overflow-wrap:anywhere");
  });
});
