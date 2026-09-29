# Obróbka grafik

Jednorazowe narzędzia do przygotowania grafik z Higgsfielda (spec wyglądu,
`docs/superpowers/specs/2026-09-28-wyglad-design.md`, §4). Każde uruchamia
Chrome'a przez playwright-core i robi pracę na canvasie.

| Skrypt | Co robi | Przykład |
|---|---|---|
| `kompresuj.mjs` | skaluje do szerokości i zapisuje WebP; tryb `alfa` zamienia czerń na przezroczystość | `node kompresuj.mjs godlo.png godlo.webp 400 0.75 alfa` |
| `tnij-klatki.mjs` | tnie arkusze sprite'ów (przezroczyste tło) na klatki wyrównane do czubka dzioba | `node tnij-klatki.mjs a.png,b.png kk 480` |
| `kolumna.mjs` | wycina kolumnę z jednolitego szarego tła i przycina do szerokości | `node kolumna.mjs kolumna.png kolumna.webp 160` |

Playwright-core instaluj poza projektem i wskaż go zmienną `NARZEDZIA`:

```powershell
npm i --prefix "$env:TEMP\grafika-narzedzia" playwright-core
$env:NARZEDZIA = "$env:TEMP\grafika-narzedzia"
node scripts/grafika/kompresuj.mjs wejscie.png wyjscie.webp 900 0.7
```

Nie dopisuj playwright-core do `package.json`.
