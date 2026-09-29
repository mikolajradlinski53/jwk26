import { KLATKI, type Animacja } from "./klatki";

/** Adres paska klatek danej animacji. */
export function adresPaska(a: Animacja): string {
  return `/grafika/zaba/${a}.webp`;
}

/**
 * Styl jednej klatki: pasek jako tło, rozciągnięty na n szerokości elementu,
 * przesunięty do klatki `i`. `skala` - 1 to 120 px wzrostu stojącej żaby.
 */
export function stylKlatki(a: Animacja, i: number, skala = 1) {
  const { klatki, szerokosc, wysokosc } = KLATKI[a];
  return {
    width: `${szerokosc * skala}px`,
    height: `${wysokosc * skala}px`,
    backgroundImage: `url(${adresPaska(a)})`,
    backgroundSize: `${klatki * 100}% 100%`,
    backgroundPosition: klatki > 1 ? `${(i / (klatki - 1)) * 100}% 0` : "0 0",
    backgroundRepeat: "no-repeat",
  };
}
