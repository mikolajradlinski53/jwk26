// Wygenerowane przez scripts/grafika/zaba.mjs — nie edytować ręcznie.
// Wymiary jednej klatki w CSS przy wzroście stojącej żaby 120 px.
export const KLATKI = {
  "chod": {
    "klatki": 8,
    "szerokosc": 81,
    "wysokosc": 118.5
  },
  "podskok": {
    "klatki": 4,
    "szerokosc": 110.5,
    "wysokosc": 131.5
  },
  "taniec": {
    "klatki": 4,
    "szerokosc": 109.5,
    "wysokosc": 120
  },
  "potkniecie": {
    "klatki": 4,
    "szerokosc": 158.5,
    "wysokosc": 117.5
  },
  "macha": {
    "klatki": 4,
    "szerokosc": 80,
    "wysokosc": 120
  },
  "siedzi": {
    "klatki": 2,
    "szerokosc": 94.5,
    "wysokosc": 93
  },
  "wskazuje": {
    "klatki": 2,
    "szerokosc": 62,
    "wysokosc": 120
  },
  "ramka": {
    "klatki": 1,
    "szerokosc": 88,
    "wysokosc": 117.5
  }
} as const;

export type Animacja = keyof typeof KLATKI;
