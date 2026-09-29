// Kontrola przecieku landingu: HTML stron publicznych i skrypty ładowane
// przez landing nie mogą zawierać miejsca, ceny ani słów motywu apki.
// Użycie: node scripts/sprawdz-przeciek.mjs https://www.jwk26.pl [--odsloniete-osrodek] [--odslonieta-cena]
const baza = process.argv[2] ?? "http://localhost:3100";
const osrodekJawny = process.argv.includes("--odsloniete-osrodek");
const cenaJawna = process.argv.includes("--odslonieta-cena");

const zakazane = [
  /sekt/i,
  /rytua/i,
  /kapła/i,
  /sanktuar/i,
  ...(osrodekJawny ? [] : [/Karpacz/, /Zielone Wzg/, /Pozna[nń]sk/, /o-4c8e1a/, /o-9b2d7f/, /osrodek-\d/]),
  ...(cenaJawna ? [] : [/\b\d{3} zł/, /przelew_kwota/]),
];

async function tekst(url) {
  const r = await fetch(url, { redirect: "follow" });
  return r.text();
}

const strony = ["/", "/regulamin", "/prywatnosc"];
const zrodla = new Map();
for (const s of strony) {
  const html = await tekst(baza + s);
  zrodla.set(`HTML ${s}`, html);
  if (s === "/") {
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      zrodla.set(`JS ${src}`, await tekst(new URL(src, baza).href));
    }
    for (const [, href] of html.matchAll(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/g)) {
      zrodla.set(`manifest ${href}`, await tekst(new URL(href, baza).href));
    }
  }
}

let bledy = 0;
for (const [nazwa, tresc] of zrodla) {
  for (const wzor of zakazane) {
    const m = tresc.match(wzor);
    if (m) {
      bledy++;
      const i = m.index ?? 0;
      console.log(`✗ ${nazwa}: ${wzor} → …${tresc.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " ")}…`);
    }
  }
}
console.log(bledy ? `Przecieki: ${bledy}` : `✓ Czysto (${zrodla.size} źródeł)`);
process.exit(bledy ? 1 : 0);
