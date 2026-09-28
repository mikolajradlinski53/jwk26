import { describe, it, expect } from "vitest";
import {
  bezOgonkow,
  kontoCzytelne,
  kontoPoprawne,
  ladunekQr,
  sciezkaQr,
} from "../src/lib/zapisy/qrPrzelewu";

const KONTO = "12 3456 7890 1234 5678 9012 3456";

describe("kod QR przelewu", () => {
  it("składa ładunek w formacie ZBP: pusty NIP, kraj, rachunek, grosze, odbiorca, tytuł", () => {
    expect(
      ladunekQr({ konto: KONTO, odbiorca: "Samorząd UEW", kwota: 320 }, "JWK26 Jan Kowalski"),
    ).toBe("|PL|12345678901234567890123456|032000|Samorzad UEW|JWK26 Jan Kowalski|||");
  });

  it("przycina odbiorcę do 20, tytuł do 32 znaków i usuwa separator z treści", () => {
    const ladunek = ladunekQr(
      { konto: KONTO, odbiorca: "Samorząd Studencki Uniwersytetu Ekonomicznego", kwota: 320 },
      "JWK26 | Bardzo Długie Imię Bardzo Długie Nazwisko",
    );
    const [, , , , odbiorca, tytul] = ladunek.split("|");
    expect(odbiorca).toHaveLength(20);
    expect(tytul.length).toBeLessThanOrEqual(32);
    // Dziewięć pól = osiem separatorów; `|` z tytułu rozwaliłby układ.
    expect(ladunek.split("|")).toHaveLength(9);
  });

  it("zdejmuje polskie znaki, także ł, którego NFD nie rozkłada", () => {
    expect(bezOgonkow("Łódź, żółć, Świeżaki")).toBe("Lodz, zolc, Swiezaki");
  });

  it("rozpoznaje i formatuje numer rachunku", () => {
    expect(kontoPoprawne(KONTO)).toBe(true);
    expect(kontoPoprawne("PL" + KONTO.replace(/ /g, ""))).toBe(true);
    expect(kontoPoprawne("1234")).toBe(false);
    expect(kontoCzytelne("12345678901234567890123456")).toBe(
      "12 3456 7890 1234 5678 9012 3456",
    );
  });

  it("rysuje kwadratową matrycę kodu", () => {
    const { rozmiar, d } = sciezkaQr("|PL|12345678901234567890123456|032000|X|Y|||");
    expect(rozmiar).toBeGreaterThanOrEqual(21);
    expect(d).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});
