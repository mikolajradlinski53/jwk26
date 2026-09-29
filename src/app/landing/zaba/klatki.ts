// Wygenerowane przez scripts/grafika/zaba.mjs — nie edytować ręcznie.
// Wymiary jednej klatki w CSS przy wzroście stojącej żaby 120 px.
export const KLATKI = {
  "siedzi": {
    "klatki": 2,
    "szerokosc": 94.5,
    "wysokosc": 93
  },
  "ramka": {
    "klatki": 1,
    "szerokosc": 88,
    "wysokosc": 117.5
  },
  "opiera": {
    "klatki": 1,
    "szerokosc": 92,
    "wysokosc": 122
  },
  "podglada": {
    "klatki": 1,
    "szerokosc": 92.5,
    "wysokosc": 34
  },
  "lornetka": {
    "klatki": 1,
    "szerokosc": 72,
    "wysokosc": 120
  },
  "pisze": {
    "klatki": 1,
    "szerokosc": 71.5,
    "wysokosc": 120
  },
  "skarbonka": {
    "klatki": 1,
    "szerokosc": 82.5,
    "wysokosc": 124.5
  },
  "plecak": {
    "klatki": 1,
    "szerokosc": 102.5,
    "wysokosc": 134
  },
  "mysli": {
    "klatki": 1,
    "szerokosc": 70,
    "wysokosc": 123
  },
  "czyta": {
    "klatki": 1,
    "szerokosc": 106,
    "wysokosc": 102
  }
} as const;

export type Animacja = keyof typeof KLATKI;
