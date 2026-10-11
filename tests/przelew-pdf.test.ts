import { describe, it, expect } from "vitest";
import { toPdf } from "../src/lib/zapisy/przelew";

describe("toPdf", () => {
  it("rozpoznaje PDF po typie albo po nazwie", () => {
    expect(toPdf(new File(["x"], "a.pdf", { type: "application/pdf" }))).toBe(true);
    // Część telefonów nie podaje typu pliku z menedżera plików.
    expect(toPdf(new File(["x"], "Potwierdzenie.PDF", { type: "" }))).toBe(true);
    expect(toPdf(new File(["x"], "zrzut.png", { type: "image/png" }))).toBe(false);
  });
});
