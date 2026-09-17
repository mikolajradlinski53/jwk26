export type Odliczanie = {
  minelo: boolean;
  dni: number;
  godziny: number;
  minuty: number;
  sekundy: number;
};

const MINIONE: Odliczanie = {
  minelo: true, dni: 0, godziny: 0, minuty: 0, sekundy: 0,
};

/**
 * Ile zostało do `docelowa`.
 *
 * Data docelowa jest zapisana z przesunięciem strefy (`+02:00`), więc wynik
 * nie zależy od tego, jak ustawiony jest telefon uczestnika — a bywa ustawiony
 * dziwnie. Po terminie zwracamy stan miniony zamiast wartości ujemnych:
 * świeżaki przyjmowane są tydzień przed wyjazdem, więc jeden licznik wygaśnie,
 * gdy drugi jeszcze chodzi, i ten przypadek zdarzy się na pewno.
 */
export function odliczanie(docelowa: string | null, teraz: Date): Odliczanie {
  if (!docelowa) return MINIONE;

  const cel = new Date(docelowa).getTime();
  if (Number.isNaN(cel)) return MINIONE;

  const roznica = cel - teraz.getTime();
  if (roznica <= 0) return MINIONE;

  const sekundyRazem = Math.floor(roznica / 1000);
  return {
    minelo: false,
    dni: Math.floor(sekundyRazem / 86400),
    godziny: Math.floor((sekundyRazem % 86400) / 3600),
    minuty: Math.floor((sekundyRazem % 3600) / 60),
    sekundy: sekundyRazem % 60,
  };
}
