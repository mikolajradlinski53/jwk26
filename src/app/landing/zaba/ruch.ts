/**
 * Silnik żaby-przewodnika jako czyste funkcje (spec landingu, sekcja 3).
 * Komponent `Przewodnik` tylko mierzy stronę i rysuje wynik.
 *
 * Trasa = dzielnik między sekcjami. Postęp trasy liczy się z położenia
 * dzielnika w oknie: 0 — dzielnik wjeżdża w dolne 85% okna (żaba za lewą
 * krawędzią), 1 — dojeżdża do górnych 15% (żaba za prawą).
 */

export const WEJSCIE = 0.85;
export const WYJSCIE = 0.15;
/** Przedział postępu, w którym żaba stoi i wskazuje (trasa przed zasłoną). */
export const WSKAZYWANIE: readonly [number, number] = [0.45, 0.6];

export function postepTrasy(gora: number, wysokoscOkna: number): number {
  const p = (WEJSCIE * wysokoscOkna - gora) / ((WEJSCIE - WYJSCIE) * wysokoscOkna);
  return Math.min(1, Math.max(0, p));
}

/**
 * Położenie w poziomie jako ułamek drogi (0 — za lewą krawędzią, 1 — za prawą).
 * Na trasie ze wskazywaniem przedział WSKAZYWANIE to postój na środku.
 */
export function ulamekDrogi(p: number, wskazuje: boolean): number {
  if (!wskazuje) return p;
  const [a, b] = WSKAZYWANIE;
  if (p < a) return (p / a) * 0.5;
  if (p <= b) return 0.5;
  return 0.5 + ((p - b) / (1 - b)) * 0.5;
}

/** Piksel lewej krawędzi żaby: od -szerokosc (schowana z lewej) do szerokości okna. */
export function polozenieX(ulamek: number, szerokoscOkna: number, szerokoscZaby: number): number {
  return -szerokoscZaby + ulamek * (szerokoscOkna + szerokoscZaby);
}

/** Czy żaba w tej chwili stoi i wskazuje. */
export function czyWskazuje(p: number, wskazuje: boolean): boolean {
  return wskazuje && p >= WSKAZYWANIE[0] && p <= WSKAZYWANIE[1];
}

/**
 * Klatka chodu z przebytej drogi, nie z czasu: nogi nie ślizgają się po
 * dzielniku niezależnie od tempa przewijania. `krok` — droga na jedną klatkę.
 */
export function klatkaChodu(droga: number, krok: number, klatek: number): number {
  const i = Math.floor(Math.abs(droga) / krok) % klatek;
  return i;
}

/** Kierunek z ostatniej zmiany położenia; bez ruchu zostaje poprzedni. */
export function kierunek(dx: number, poprzedni: 1 | -1): 1 | -1 {
  if (dx > 0.5) return 1;
  if (dx < -0.5) return -1;
  return poprzedni;
}

/** Wybór trasy: ta z postępem w (0, 1), najbliższa środkowi okna. */
export function aktywnaTrasa(
  trasy: { gora: number; dol: number }[],
  wysokoscOkna: number,
): number {
  let najlepsza = -1;
  let odleglosc = Infinity;
  trasy.forEach((t, i) => {
    const p = postepTrasy(t.gora, wysokoscOkna);
    if (p <= 0 || p >= 1) return;
    const o = Math.abs((t.gora + t.dol) / 2 - wysokoscOkna / 2);
    if (o < odleglosc) {
      odleglosc = o;
      najlepsza = i;
    }
  });
  return najlepsza;
}
