/**
 * Ścieżki zdjęć i filmów w buckecie `bingo` - wspólne dla przeglądarki i
 * serwera (trasa /app/feed/zdjecie). Filmy od 2026-10-23: poznaje się je po
 * rozszerzeniu, okładka leży obok jako `.podglad.jpg`, tak jak podgląd zdjęcia.
 */

/** Ścieżka podglądu (720 px; dla filmu okładka) obok pełnego pliku. */
export function sciezkaPodgladu(sciezka: string): string {
  return sciezka.replace(/\.[A-Za-z0-9]+$/, ".podglad.jpg");
}

/** Film poznajemy po rozszerzeniu ścieżki. */
export function jestFilm(sciezka: string): boolean {
  return /\.(mp4|mov|webm)$/i.test(sciezka);
}

const ROZSZERZENIA_FILMOW: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Rozszerzenie dla typu filmu, który przyjmuje bucket; null - nieobsługiwany. */
export function rozszerzenieFilmu(typ: string): string | null {
  return ROZSZERZENIA_FILMOW[typ] ?? null;
}

/** Limity filmu: plik w Supabase do 50 MB, długość pilnuje apka przy wysyłce. */
export const FILM_MAX_MB = 50;
export const FILM_MAX_SEKUND = 30;
