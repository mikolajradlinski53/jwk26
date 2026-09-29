/**
 * Fizyka kruka - czysta logika, bez rysowania i bez Reacta.
 *
 * Świat ma stałe jednostki logiczne (360 × 480), więc gra zachowuje się tak
 * samo na każdym ekranie; komponent tylko skaluje rysunek. Prędkość pozioma
 * jest stała: kolumny mijają kruka w równym rytmie i na tym opiera się
 * sprawdzenie wyniku w bazie (kruk_wynik).
 */

export const SWIAT = { szer: 360, wys: 480 } as const;
export const KROK_S = 1 / 60;

export const KRUK_X = 90;
export const KRUK_R = 12;
export const GRAWITACJA = 1400; // jednostek/s²
export const MACHNIECIE = -420; // prędkość pionowa tuż po machnięciu
export const PREDKOSC = 150; // jednostek/s w poziomie

/**
 * Co ile sekund nowa kolumna. Ta sama wartość siedzi w kruk_wynik()
 * (`c_odstep_kolumn_s`) - test pilnuje, żeby się nie rozjechały.
 */
export const ODSTEP_KOLUMN_S = 1.5;
export const SZER_KOLUMNY = 56;
export const SZCZELINA = 140;
/** Najmniejszy odstęp szczeliny od sufitu i od ziemi. */
export const MARGINES_SZCZELINY = 40;

/**
 * Kapitel kolumny w jednostkach świata (grafika public/grafika/kruk/kolumna.webp:
 * wysięg ~14, wysokość szerokiej części ~23). Kolizja lekko łaskawsza od rysunku.
 * Bez tego kruk przelatywałby przez widoczny kamień (spec wyglądu, D5).
 */
export const KAPITEL_WYSTAJE = 12;
export const KAPITEL_WYS = 22;

export type Kolumna = { x: number; srodek: number; minieta: boolean };

export type Stan = {
  y: number;
  vy: number;
  kolumny: Kolumna[];
  /** Sekundy do pojawienia się następnej kolumny. */
  doNastepnej: number;
  wynik: number;
  czas: number;
  rozbity: boolean;
};

export function nowyStan(): Stan {
  return { y: SWIAT.wys / 2, vy: 0, kolumny: [], doNastepnej: 0, wynik: 0, czas: 0, rozbity: false };
}

/**
 * Najwyższy wynik, jaki baza uzna po tylu sekundach - lustro warunku
 * z kruk_wynik(). Pierwsza kolumna dolatuje do kruka po ok. 2,25 s, każda
 * następna co ODSTEP_KOLUMN_S, więc uczciwy lot zawsze się w nim mieści.
 */
export function limitWyniku(sekundy: number): number {
  return Math.floor(sekundy / ODSTEP_KOLUMN_S) + 1;
}

function srodekSzczeliny(los: number): number {
  const min = MARGINES_SZCZELINY + SZCZELINA / 2;
  const max = SWIAT.wys - MARGINES_SZCZELINY - SZCZELINA / 2;
  return min + los * (max - min);
}

/** Koło kruka kontra prostokąt: najbliższy punkt prostokąta bliżej niż promień. */
function styka(y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const px = Math.max(x0, Math.min(KRUK_X, x1));
  const py = Math.max(y0, Math.min(y, y1));
  return (KRUK_X - px) ** 2 + (y - py) ** 2 < KRUK_R ** 2;
}

function uderza(y: number, k: Kolumna): boolean {
  const gora = k.srodek - SZCZELINA / 2;
  const dol = k.srodek + SZCZELINA / 2;
  const x1 = k.x + SZER_KOLUMNY;
  const kx0 = k.x - KAPITEL_WYSTAJE;
  const kx1 = x1 + KAPITEL_WYSTAJE;
  return (
    styka(y, k.x, 0, x1, gora) ||
    styka(y, k.x, dol, x1, SWIAT.wys) ||
    styka(y, kx0, gora - KAPITEL_WYS, kx1, gora) ||
    styka(y, kx0, dol, kx1, dol + KAPITEL_WYS)
  );
}

/**
 * Jeden krok symulacji. Zwraca nowy stan, stary zostaje nietknięty.
 * `losuj` daje liczbę z [0, 1) na wysokość nowej szczeliny - testy podają stałą.
 */
export function krok(
  s: Stan,
  dt: number,
  machniecie: boolean,
  losuj: () => number = Math.random,
): Stan {
  if (s.rozbity) return s;

  const vy = (machniecie ? MACHNIECIE : s.vy) + GRAWITACJA * dt;
  const y = s.y + vy * dt;
  const czas = s.czas + dt;

  let wynik = s.wynik;
  const kolumny: Kolumna[] = [];
  for (const k of s.kolumny) {
    const x = k.x - PREDKOSC * dt;
    if (x + SZER_KOLUMNY < 0) continue;
    let minieta = k.minieta;
    if (!minieta && x + SZER_KOLUMNY < KRUK_X - KRUK_R) {
      minieta = true;
      wynik += 1;
    }
    kolumny.push({ x, srodek: k.srodek, minieta });
  }

  let doNastepnej = s.doNastepnej - dt;
  while (doNastepnej <= 0) {
    // Nadmiar czasu przesuwa nową kolumnę w lewo - odstępy zostają równe co do jednostki.
    kolumny.push({
      x: SWIAT.szer + doNastepnej * PREDKOSC,
      srodek: srodekSzczeliny(losuj()),
      minieta: false,
    });
    doNastepnej += ODSTEP_KOLUMN_S;
  }

  const rozbity =
    y - KRUK_R < 0 || y + KRUK_R > SWIAT.wys || kolumny.some((k) => uderza(y, k));

  return { y, vy, kolumny, doNastepnej, wynik, czas, rozbity };
}
