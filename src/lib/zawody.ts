// Zawody (paczka D2): typy i tabela „każdy z każdym”.

export type Zawody = {
  id: string;
  nazwa: string;
  opis: string;
  druzynowe: boolean;
  rozmiar_skladu: number | null;
  wymaga_dziewczyny: boolean;
  limit_miejsc: number | null;
  zapisy_otwarte: boolean;
  kolejnosc: number;
};

export type DruzynaZawodow = {
  id: string;
  zawody_id: string;
  nazwa: string;
  zalozyciel_id: string;
  dziewczyna_potwierdzona: boolean;
  created_at: string;
};

export type Mecz = {
  id: string;
  zawody_id: string;
  runda: number;
  druzyna_a: string;
  druzyna_b: string;
  wynik_a: number | null;
  wynik_b: number | null;
};

export type WierszTabeli = {
  druzynaId: string;
  nazwa: string;
  mecze: number;
  wygrane: number;
  remisy: number;
  porazki: number;
  zdobyte: number;
  stracone: number;
  punkty: number;
};

/** 3 pkt za wygraną, 1 za remis. Kolejność: punkty, różnica, zdobyte, nazwa. */
export function tabela(druzyny: Pick<DruzynaZawodow, "id" | "nazwa">[], mecze: Mecz[]): WierszTabeli[] {
  const wiersze = new Map<string, WierszTabeli>(
    druzyny.map((d) => [
      d.id,
      { druzynaId: d.id, nazwa: d.nazwa, mecze: 0, wygrane: 0, remisy: 0, porazki: 0, zdobyte: 0, stracone: 0, punkty: 0 },
    ]),
  );
  for (const m of mecze) {
    if (m.wynik_a === null || m.wynik_b === null) continue;
    const a = wiersze.get(m.druzyna_a);
    const b = wiersze.get(m.druzyna_b);
    if (!a || !b) continue;
    a.mecze += 1;
    b.mecze += 1;
    a.zdobyte += m.wynik_a;
    a.stracone += m.wynik_b;
    b.zdobyte += m.wynik_b;
    b.stracone += m.wynik_a;
    if (m.wynik_a > m.wynik_b) {
      a.wygrane += 1;
      b.porazki += 1;
      a.punkty += 3;
    } else if (m.wynik_a < m.wynik_b) {
      b.wygrane += 1;
      a.porazki += 1;
      b.punkty += 3;
    } else {
      a.remisy += 1;
      b.remisy += 1;
      a.punkty += 1;
      b.punkty += 1;
    }
  }
  return [...wiersze.values()].sort(
    (x, y) =>
      y.punkty - x.punkty ||
      y.zdobyte - y.stracone - (x.zdobyte - x.stracone) ||
      y.zdobyte - x.zdobyte ||
      x.nazwa.localeCompare(y.nazwa, "pl"),
  );
}

/** Błąd z funkcji zawodów → zdanie dla uczestnika. */
export function komunikatZawodow(e: unknown): string {
  const t = String((e as { message?: unknown })?.message ?? e);
  const zajeci = t.match(/SKLAD_ZAJETY: (.+)$/);
  if (zajeci) return `Już w innym składzie: ${zajeci[1]}.`;
  const rozmiar = t.match(/SKLAD_ROZMIAR: sklad liczy (\d+)/);
  if (rozmiar) return `Skład liczy dokładnie ${rozmiar[1]} osób razem z Tobą.`;
  if (/ZAPISY_ZAMKNIETE/.test(t)) return "Zapisy na te zawody są zamknięte.";
  if (/SKLAD_BEZ_DZIEWCZYNY/.test(t)) return "W Topalkach skład musi mieć co najmniej jedną dziewczynę - potwierdź to.";
  if (/SKLAD_NIEPRZYJETY/.test(t)) return "W składzie może być tylko przyjęty uczestnik wyjazdu.";
  if (/NAZWA_DRUZYNY_ZAJETA/.test(t)) return "Ta nazwa składu jest już zajęta.";
  if (/NAZWA_DRUZYNY_DLUGOSC/.test(t)) return "Nazwa składu ma od 1 do 40 znaków.";
  if (/ZAWODY_PELNE/.test(t)) return "Miejsca się skończyły.";
  if (/pelny/.test(t)) return "Skład jest już pełny.";
  if (/osoba, ktora go zapisala/.test(t)) return "Skład uzupełnia osoba, która go zapisała.";
  if (/MECZE_MAJA_WYNIKI/.test(t)) return "Terminarz ma już wyniki - nie da się go ułożyć od nowa.";
  if (/zamknij zapisy/.test(t)) return "Najpierw zamknij zapisy.";
  if (/Za malo skladow/.test(t)) return "Do terminarza potrzeba co najmniej dwóch składów.";
  if (/failed to fetch|network/i.test(t)) return "Zerwało połączenie. Spróbuj jeszcze raz.";
  return "Coś poszło nie tak. Odśwież i spróbuj jeszcze raz.";
}
