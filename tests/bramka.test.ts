import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const KORZEN = resolve(__dirname, "../src/app");

/**
 * Ekrany dostępne bez zalogowania. Każdy inny musi siedzieć pod /app,
 * bo tylko ten prefiks obejmuje bramka w proxy.ts.
 */
const PUBLICZNE_EKRANY = new Set(["/", "/wejscie"]);

/**
 * Uchwyty tras dostępne bez zalogowania — osobna lista, bo osobne ryzyko.
 *
 * `/auth/callback` musi być publiczny: przyjmuje powrót od Google, gdy sesji
 * jeszcze nie ma. `/auth/signout` tylko kończy sesję i niczego nie czyta.
 *
 * Każdy inny uchwyt poza /app wywali ten test — i o to chodzi. Uchwyt zwraca
 * dane wprost, bez ekranu, więc zapomniany jest groźniejszy niż zapomniana
 * strona: nie widać go w interfejsie, a odpowiada każdemu, kto zna adres.
 */
const PUBLICZNE_UCHWYTY = new Set(["/auth/callback", "/auth/signout"]);

type Trasa = { sciezka: string; rodzaj: "ekran" | "uchwyt" };

/**
 * Zbiera adresy wszystkich tras z systemu plików.
 *
 * Czytamy katalogi, a nie konfigurację, właśnie dlatego, że nikt nie musi
 * o tym teście pamiętać: nowy plik pojawia się na dysku i test go widzi.
 */
function trasy(katalog: string, prefiks = ""): Trasa[] {
  const znalezione: Trasa[] = [];
  for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
    if (wpis.isDirectory()) {
      // Grupy tras `(nazwa)` nie tworzą segmentu adresu.
      const segment = wpis.name.startsWith("(") ? "" : `/${wpis.name}`;
      znalezione.push(...trasy(join(katalog, wpis.name), prefiks + segment));
    } else if (wpis.name === "page.tsx") {
      znalezione.push({ sciezka: prefiks === "" ? "/" : prefiks, rodzaj: "ekran" });
    } else if (wpis.name === "route.ts") {
      znalezione.push({ sciezka: prefiks === "" ? "/" : prefiks, rodzaj: "uchwyt" });
    }
  }
  return znalezione;
}

describe("bramka obejmuje każdy ekran apki", () => {
  it("nie istnieje ekran poza /app, który nie jest świadomie publiczny", () => {
    const poza = trasy(KORZEN)
      .filter((t) => t.rodzaj === "ekran")
      .map((t) => t.sciezka)
      .filter((s) => !s.startsWith("/app") && !PUBLICZNE_EKRANY.has(s));
    expect(poza).toEqual([]);
  });

  /*
   * Ten przypadek dopisano po tym, jak przegląd wykazał lukę: test patrzył
   * wyłącznie na page.tsx. Recenzent dodał route.ts z danymi poza /app —
   * pakiet pozostał zielony, a plik odpowiadał każdemu kodem 200 z treścią.
   */
  it("nie istnieje uchwyt trasy poza /app, który nie jest świadomie publiczny", () => {
    const poza = trasy(KORZEN)
      .filter((t) => t.rodzaj === "uchwyt")
      .map((t) => t.sciezka)
      .filter((s) => !s.startsWith("/app") && !PUBLICZNE_UCHWYTY.has(s));
    expect(poza).toEqual([]);
  });

  it("matcher w proxy.ts pilnuje prefiksu /app", async () => {
    const { config } = await import("../src/proxy");
    expect(config.matcher).toContain("/app/:path*");
  });
});
