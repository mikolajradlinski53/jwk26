import { describe, it, expect } from "vitest";
import { kontoSamorzadowe } from "../src/lib/konto";

describe("kontoSamorzadowe - lustro funkcji z bazy", () => {
  it("domena Samorządu bez względu na wielkość liter i spacje", () => {
    expect(kontoSamorzadowe("jan.kowalski@samorzad.ue.wroc.pl")).toBe(true);
    expect(kontoSamorzadowe(" Jan@Samorzad.UE.Wroc.pl ")).toBe(true);
  });
  it("prywatny adres, podróbka domeny i brak adresu - nie", () => {
    expect(kontoSamorzadowe("ktos@gmail.com")).toBe(false);
    expect(kontoSamorzadowe("ktos@samorzad.ue.wroc.pl.evil.com")).toBe(false);
    expect(kontoSamorzadowe(null)).toBe(false);
    expect(kontoSamorzadowe(undefined)).toBe(false);
  });
});
