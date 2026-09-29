// Tnie arkusze sprite'ów (przezroczyste tło) na klatki rozdzielone pustymi
// kolumnami, wyrównuje je do czubka dzioba (skrajnie prawy nieprzezroczysty
// piksel) i zapisuje jako PNG o wspólnym rozmiarze i wspólnej skali.
// node tnij-klatki.mjs <arkusz1.png,arkusz2.png> <prefiks-wyjścia> <docelowa-szerokość>
// Klatki numerowane kolejno: arkusz 1 od lewej, potem arkusz 2 od lewej.
// Wymaga playwright-core i Chrome'a. NIE instaluj playwright-core w projekcie:
//   npm i --prefix "$env:TEMP\grafika-narzedzia" playwright-core
//   $env:NARZEDZIA = "$env:TEMP\grafika-narzedzia"
// Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe
import { createRequire } from "node:module";
const require = createRequire(process.env.NARZEDZIA ? `${process.env.NARZEDZIA}/x.js` : import.meta.url);
const { chromium } = require("playwright-core");
import { readFileSync, writeFileSync } from "node:fs";

const [wejscia, prefiks, docelowa = "360"] = process.argv.slice(2);
const arkusze = wejscia.split(",").map((w) => readFileSync(w).toString("base64"));

const p = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const s = await p.newPage();
const wynik = await s.evaluate(
  async ({ arkusze, docelowa }) => {
    const PROG = 24;
    const wszystkie = [];
    for (const b64 of arkusze) {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const W = img.width, H = img.height;
      const c = new OffscreenCanvas(W, H);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      const pelna = (x, y) => d[(y * W + x) * 4 + 3] > PROG;
      const kol = new Array(W).fill(false);
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y += 2) if (pelna(x, y)) { kol[x] = true; break; }
      for (let x = 0; x < W; ) {
        if (!kol[x]) { x++; continue; }
        const a = x;
        while (x < W && kol[x]) x++;
        if (x - a <= 40) continue;
        const x0 = a, x1 = x - 1;
        let y0 = H, y1 = 0, dziobX = x0, dziobY = 0;
        for (let xx = x0; xx <= x1; xx++) for (let y = 0; y < H; y++) if (pelna(xx, y)) {
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (xx >= dziobX) { dziobX = xx; dziobY = y; }
        }
        wszystkie.push({ img, x0, x1, y0, y1, dziobX, dziobY });
      }
    }
    const lewo = Math.max(...wszystkie.map((k) => k.dziobX - k.x0));
    const gora = Math.max(...wszystkie.map((k) => k.dziobY - k.y0));
    const dol = Math.max(...wszystkie.map((k) => k.y1 - k.dziobY));
    const ramaW = lewo + 1, ramaH = gora + dol + 1;
    const skala = docelowa / ramaW;
    const outW = Math.round(ramaW * skala), outH = Math.round(ramaH * skala);
    const pliki = [];
    for (const k of wszystkie) {
      const o = new OffscreenCanvas(outW, outH);
      const og = o.getContext("2d");
      og.imageSmoothingQuality = "high";
      const dx = (lewo - (k.dziobX - k.x0)) * skala;
      const dy = (gora - (k.dziobY - k.y0)) * skala;
      const w = k.x1 - k.x0 + 1, h = k.y1 - k.y0 + 1;
      og.drawImage(k.img, k.x0, k.y0, w, h, dx, dy, w * skala, h * skala);
      const blob = await o.convertToBlob({ type: "image/png" });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      pliki.push(btoa(bin));
    }
    return { outW, outH, dziob: { x: lewo * skala, y: gora * skala }, pliki };
  },
  { arkusze, docelowa: Number(docelowa) },
);
wynik.pliki.forEach((f, i) => writeFileSync(`${prefiks}-${i + 1}.png`, Buffer.from(f, "base64")));
console.log(JSON.stringify({ klatki: wynik.pliki.length, rozmiar: [wynik.outW, wynik.outH], dziob: wynik.dziob }));
await p.close();
