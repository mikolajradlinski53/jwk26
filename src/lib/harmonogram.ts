/** Punkt programu w kształcie wiersza tabeli `harmonogram`. */
export type PunktHarmonogramu = {
  id: string;
  dzien: string; // YYYY-MM-DD
  godzina: string | null; // HH:MM:SS
  tytul: string;
  opis: string | null;
};

export type DzienHarmonogramu = { dzien: string; punkty: PunktHarmonogramu[] };

/** Kolejność jak w indeksie bazy: dzień, potem godzina, punkty bez godziny na początku dnia. */
export function grupujPoDniach(punkty: PunktHarmonogramu[]): DzienHarmonogramu[] {
  const posortowane = [...punkty].sort(
    (a, b) => a.dzien.localeCompare(b.dzien) || (a.godzina ?? "").localeCompare(b.godzina ?? ""),
  );
  const dni: DzienHarmonogramu[] = [];
  for (const p of posortowane) {
    const ostatni = dni.at(-1);
    if (ostatni?.dzien === p.dzien) ostatni.punkty.push(p);
    else dni.push({ dzien: p.dzien, punkty: [p] });
  }
  return dni;
}

/**
 * „piątek, 23 października”. Data bez godziny liczona w UTC — w strefie
 * przeglądarki północ mogłaby się przesunąć na poprzedni dzień.
 */
export function nazwaDnia(dzien: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dzien}T12:00:00Z`));
}

/** „08:30” z „08:30:00”; pusta godzina zostaje pusta. */
export function krotkaGodzina(godzina: string | null): string | null {
  return godzina ? godzina.slice(0, 5) : null;
}
