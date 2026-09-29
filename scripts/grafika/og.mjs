// Obrazek podglądu linku (1200×630): zdjęcie z hero, przyciemnienie od dołu
// i białe logo. Bez miejsca i bez dat — jeden obraz na cały okres zasłon.
// Uruchomienie z katalogu projektu: node scripts/grafika/og.mjs
import sharp from "sharp";

const W = 1200;
const H = 630;
const SZEROKOSC_LOGO = 760;

const tlo = await sharp("public/hero/hero-8.jpg").resize(W, H, { fit: "cover", position: "attention" }).toBuffer();
const przyciemnienie = Buffer.from(
  `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="#0c0709" stop-opacity="0.35"/>
     <stop offset="1" stop-color="#0c0709" stop-opacity="0.7"/></linearGradient></defs>
     <rect width="100%" height="100%" fill="url(#g)"/></svg>`,
);
const logo = await sharp("public/logo/logo-biale.png").resize({ width: SZEROKOSC_LOGO }).toBuffer();
const { height: wysokoscLogo = 283 } = await sharp(logo).metadata();

await sharp(tlo)
  .composite([
    { input: przyciemnienie, top: 0, left: 0 },
    { input: logo, top: Math.round((H - wysokoscLogo) / 2), left: Math.round((W - SZEROKOSC_LOGO) / 2) },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile("src/app/opengraph-image.jpg");
console.log("zapisano src/app/opengraph-image.jpg");
