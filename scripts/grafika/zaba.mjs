// Klatki żaby → paski WebP (jedna animacja = jeden pasek poziomy) + opis
// wymiarów dla silnika w src/app/landing/zaba/klatki.ts.
//
// Klatki źródłowe (PNG z przezroczystością) powstały z arkuszy Higgsfielda
// (projekt „JWK26 — oprawa wizualna”) cięte lokalnie; każda animacja ma już
// klatki na wspólnym płótnie (stopy na dole). Arkusze były w różnej skali,
// więc każda animacja ma swoją „wysokość stojącej żaby” w pikselach źródła —
// po przeskalowaniu żaba ma ten sam wzrost w każdej animacji.
//
// Uruchomienie: node scripts/grafika/zaba.mjs <katalog z klatkami>
import sharp from "sharp";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const zrodlo = process.argv[2];
if (!zrodlo) throw new Error("Podaj katalog z klatkami");

// Wzrost stojącej żaby na ekranie w CSS to 120 px (komputer); pasek w 2× dla ekranów retina.
const WZROST = 240;

// nazwa w silniku, prefiks plików, wzrost stojącej żaby w pikselach źródła
// Pozy do sekcji (arkusz ab04f5e8) mają wspólną skalę: stojąca żaba 698 px.
// Chód i wygłupy z pierwszej wersji (wędrująca żaba) wypadły 2026-09-29 —
// Mikołaj wolał żabę wpisaną w każdą sekcję; klatki zostały w scratchpadzie.
const ANIMACJE = [
  ["siedzi", "siedzi", 785],
  ["ramka", "ramka", 875],
  ["opiera", "opiera", 698],
  ["podglada", "podglada", 698],
  ["lornetka", "lornetka", 698],
  ["pisze", "pisze", 698],
  ["skarbonka", "skarbonka", 698],
  ["plecak", "plecak", 698],
  ["mysli", "mysli", 698],
  ["czyta", "czyta", 698],
];

const wyjscie = "public/grafika/zaba";
mkdirSync(wyjscie, { recursive: true });
const opis = {};

for (const [nazwa, prefiks, wzrost] of ANIMACJE) {
  const pliki = readdirSync(zrodlo).filter((f) => f.startsWith(`${prefiks}-`) && f.endsWith(".png")).sort();
  const skala = WZROST / wzrost;
  const klatki = await Promise.all(
    pliki.map(async (f) => {
      const im = sharp(join(zrodlo, f));
      const { width, height } = await im.metadata();
      return im.resize(Math.round(width * skala), Math.round(height * skala)).png().toBuffer();
    }),
  );
  const { width: w, height: h } = await sharp(klatki[0]).metadata();
  await sharp({ create: { width: w * klatki.length, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(klatki.map((input, i) => ({ input, left: i * w, top: 0 })))
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(join(wyjscie, `${nazwa}.webp`));
  // Wymiary w CSS (połowa pikseli paska).
  opis[nazwa] = { klatki: klatki.length, szerokosc: w / 2, wysokosc: h / 2 };
  console.log(nazwa, klatki.length, "klatek", w, "x", h);
}

writeFileSync(
  "src/app/landing/zaba/klatki.ts",
  `// Wygenerowane przez scripts/grafika/zaba.mjs — nie edytować ręcznie.\n` +
    `// Wymiary jednej klatki w CSS przy wzroście stojącej żaby ${WZROST / 2} px.\n` +
    `export const KLATKI = ${JSON.stringify(opis, null, 2)} as const;\n\n` +
    `export type Animacja = keyof typeof KLATKI;\n`,
);
