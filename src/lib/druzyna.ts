/** Stan z `stan_glosowania()` - dla drużyny osoby zalogowanej. */
export type StanGlosowania = {
  team_id: string;
  numer: number | null;
  nazwa: string;
  nazwa_nadana: boolean;
  etap: "nie_rozpoczete" | "trwa" | "zakonczone";
  kapitan_id: string | null;
  czlonkow: number;
  glosow: number;
  moj_glos: string | null;
};

export const NAZWA_MAX = 30;
export const MOTTO_MAX = 60;

/** Lustro reguł `nadaj_nazwe_druzyny` - podpowiedź przed wysłaniem. */
export function bladNazwy(nazwa: string, motto: string): string | null {
  const n = nazwa.trim();
  if (n.length < 1) return "Wpisz nazwę drużyny";
  if (n.length > NAZWA_MAX) return `Nazwa ma najwyżej ${NAZWA_MAX} znaków`;
  if (motto.trim().length > MOTTO_MAX) return `Motto ma najwyżej ${MOTTO_MAX} znaków`;
  return null;
}
