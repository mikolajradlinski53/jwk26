/**
 * Współrzędne z linku Map Google (gra terenowa, 2026-10-15). Admin wkleja
 * to, co daje „Udostępnij” w Mapach Google albo pasek adresu - formatów jest
 * kilka, a każdy niesie współrzędne gdzie indziej.
 */
export type Punkt = { lat: number; lng: number };

const LICZBA = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function punkt(lat: string, lng: string): Punkt | null {
  const p = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null;
  return p;
}

export function wspolrzedneZTekstu(tekst: string): Punkt | null {
  let t = tekst.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    // Zostaje surowy tekst - procent bez pary nie przekreśla współrzędnych.
  }

  // 1. Pinezka miejsca: ...!3d50.7781!4d15.7563 - dokładniejsza niż środek widoku.
  const pinezka = t.match(new RegExp(String.raw`!3d${LICZBA}!4d${LICZBA}`));
  if (pinezka) return punkt(pinezka[1], pinezka[2]);

  // 2. Parametr z punktem: ?q=50.77,15.75, query=, ll=, destination=, center=.
  const parametr = t.match(new RegExp(String.raw`[?&](?:q|query|ll|destination|center|daddr)=${LICZBA},\s*\+?${LICZBA}`));
  if (parametr) return punkt(parametr[1], parametr[2]);

  // 3. Środek widoku: /@50.7781,15.7563,17z
  const widok = t.match(new RegExp(String.raw`@${LICZBA},${LICZBA}`));
  if (widok) return punkt(widok[1], widok[2]);

  // 4. Same współrzędne: „50.7781, 15.7563”.
  const gole = t.match(new RegExp(String.raw`^${LICZBA}\s*[,;\s]\s*${LICZBA}$`));
  if (gole) return punkt(gole[1], gole[2]);

  return null;
}

/** Krótki link z „Udostępnij” (maps.app.goo.gl) trzeba najpierw rozwinąć po stronie serwera. */
export function toKrotkiLink(tekst: string): boolean {
  try {
    const u = new URL(tekst.trim());
    return ["maps.app.goo.gl", "goo.gl", "g.co"].includes(u.hostname);
  } catch {
    return false;
  }
}

/** Nawigacja piesza w Mapach Google - na telefonie otwiera aplikację. */
export function linkNawigacji(p: Punkt): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
}
