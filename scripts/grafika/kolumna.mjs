// Wycina kolumnę z jednolitego szarego tła (kluczowanie koloru), przycina do
// jej szerokości i zapisuje WebP z przezroczystością.
// node kolumna.mjs <wejście.png> <wyjście.webp> <szerokość-wyjścia>
// Wymaga playwright-core i Chrome'a. NIE instaluj playwright-core w projekcie:
//   npm i --prefix "$env:TEMP\grafika-narzedzia" playwright-core
//   $env:NARZEDZIA = "$env:TEMP\grafika-narzedzia"
// Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe
import { createRequire } from "node:module";
const require = createRequire(process.env.NARZEDZIA ? `${process.env.NARZEDZIA}/x.js` : import.meta.url);
const { chromium } = require("playwright-core");
import { readFileSync, writeFileSync } from "node:fs";

const [wejscie, wyjscie, szer] = process.argv.slice(2);
const b64 = readFileSync(wejscie).toString("base64");
const p = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const s = await p.newPage();
const out = await s.evaluate(
  async ({ b64, szer }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const W = img.width, H = img.height;
    const c = new OffscreenCanvas(W, H);
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const dane = g.getImageData(0, 0, W, H);
    const px = dane.data;
    // Kolor tła z rogu obrazka.
    const [br, bg, bb] = [px[0], px[1], px[2]];
    let x0 = W, x1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb);
      if (d < 18) px[i + 3] = 0;
      else if (d < 40) px[i + 3] = Math.round(((d - 18) / 22) * 255);
      else { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
    g.putImageData(dane, 0, 0);
    const w = x1 - x0 + 1;
    const outW = szer, outH = Math.round((H * szer) / w);
    const o = new OffscreenCanvas(outW, outH);
    const og = o.getContext("2d");
    og.imageSmoothingQuality = "high";
    og.drawImage(c, x0, 0, w, H, 0, 0, outW, outH);
    const blob = await o.convertToBlob({ type: "image/webp", quality: 0.85 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(bin), outW, outH };
  },
  { b64, szer: Number(szer) },
);
writeFileSync(wyjscie, Buffer.from(out.b64, "base64"));
console.log(wyjscie, out.outW + "x" + out.outH, Buffer.from(out.b64, "base64").length, "B");
await p.close();
