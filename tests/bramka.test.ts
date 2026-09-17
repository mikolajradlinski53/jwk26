import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const KORZEN = resolve(__dirname, "../src/app");

// Trasy, które mają być publiczne świadomie. Każda inna musi siedzieć
// pod /app, bo tylko ten prefiks obejmuje bramka w proxy.ts.
const PUBLICZNE = new Set(["/", "/login"]);

/** Zbiera adresy wszystkich stron z systemu plików. */
function trasy(katalog: string, prefiks = ""): string[] {
  const znalezione: string[] = [];
  for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
    if (wpis.isDirectory()) {
      // Grupy tras `(nazwa)` nie tworzą segmentu adresu.
      const segment = wpis.name.startsWith("(") ? "" : `/${wpis.name}`;
      znalezione.push(...trasy(join(katalog, wpis.name), prefiks + segment));
    } else if (wpis.name === "page.tsx") {
      znalezione.push(prefiks === "" ? "/" : prefiks);
    }
  }
  return znalezione;
}

describe("bramka obejmuje każdy ekran apki", () => {
  it("nie istnieje ekran poza /app, który nie jest świadomie publiczny", () => {
    const poza = trasy(KORZEN).filter(
      (t) => !t.startsWith("/app") && !PUBLICZNE.has(t),
    );
    expect(poza).toEqual([]);
  });

  it("matcher w proxy.ts pilnuje prefiksu /app", async () => {
    const { config } = await import("../src/proxy");
    expect(config.matcher).toContain("/app/:path*");
  });
});
