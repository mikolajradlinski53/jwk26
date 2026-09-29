// Skaluje obraz do zadanej szerokości i zapisuje jako WebP.
// node kompresuj.mjs <wejście> <wyjście.webp> <szerokość> [jakość 0-1]
// Wymaga playwright-core i Chrome'a. NIE instaluj playwright-core w projekcie:
//   npm i --prefix "$env:TEMP\grafika-narzedzia" playwright-core
//   $env:NARZEDZIA = "$env:TEMP\grafika-narzedzia"
// Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe
import { createRequire } from "node:module";
const require = createRequire(process.env.NARZEDZIA ? `${process.env.NARZEDZIA}/x.js` : import.meta.url);
const { chromium } = require("playwright-core");
import { readFileSync, writeFileSync } from "node:fs";

const [wejscie, wyjscie, szer, jakosc = "0.72", tryb = ""] = process.argv.slice(2);
const b64 = readFileSync(wejscie).toString("base64");
const p = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const s = await p.newPage();
const out = await s.evaluate(
  async ({ b64, szer, jakosc, czernNaAlfe }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const w = szer, h = Math.round((img.height * szer) / img.width);
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    if (czernNaAlfe) {
      // Rycina na czerni: najjaśniejszy kanał staje się nieprzezroczystością,
      // a kolor jest „odmnażany", żeby po nałożeniu na tło wyglądał jak na czerni.
      const dane = g.getImageData(0, 0, w, h);
      const px = dane.data;
      for (let i = 0; i < px.length; i += 4) {
        const a = Math.max(px[i], px[i + 1], px[i + 2]);
        const a2 = a < 10 ? 0 : a; // szum kompresji w czerni → pełna przezroczystość
        if (a2 === 0) { px[i + 3] = 0; continue; }
        px[i] = Math.min(255, (px[i] * 255) / a2);
        px[i + 1] = Math.min(255, (px[i + 1] * 255) / a2);
        px[i + 2] = Math.min(255, (px[i + 2] * 255) / a2);
        px[i + 3] = a2;
      }
      g.putImageData(dane, 0, 0);
    }
    const blob = await c.convertToBlob({ type: "image/webp", quality: jakosc });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  },
  { b64, szer: Number(szer), jakosc: Number(jakosc), czernNaAlfe: tryb === "alfa" },
);
writeFileSync(wyjscie, Buffer.from(out, "base64"));
console.log(wyjscie, Buffer.from(out, "base64").length, "B");
await p.close();

