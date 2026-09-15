/**
 * Słowa, których obecność podnosi wiarygodność zdjęcia jako dowodu przelewu.
 * Zapisane bez ogonków, bo porównanie idzie na tekście po normalizacji.
 */
export const SLOWA_KLUCZOWE = [
  "przelew",
  "kwota",
  "pln",
  "tytul",
  "odbiorca",
  "iban",
] as const;

/**
 * Sprowadza polskie znaki do łacińskich odpowiedników.
 *
 * Samo NFD nie wystarcza: „ł" i „Ł" to w Unicode osobne litery, a nie „l"
 * z doklejonym znakiem diakrytycznym, więc rozkład ich nie rusza. Stąd dwa
 * jawne podstawienia po normalizacji.
 */
export function bezOgonkow(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

/** Które ze słów kluczowych wystąpiły w rozpoznanym tekście. */
export function trafioneSlowa(tekst: string): string[] {
  const znormalizowany = bezOgonkow(tekst).toLowerCase();
  return SLOWA_KLUCZOWE.filter((slowo) => znormalizowany.includes(slowo));
}
