import type { ReactNode } from "react";

/**
 * Sześć symboli bębnów, rysowanych w miejscu — jak ikony paska nawigacji
 * i półki. Muszą być czytelne przy 40 px, w ciemności, i **odróżnialne od
 * siebie na pierwszy rzut oka**: to jedyna informacja o wyniku spinu.
 *
 * Osobny zbiór od IkonaPozycji, mimo tego samego stylu: półka mówi „co
 * dostaniesz", bębny „co wypadło". Wspólny plik obsługiwałby dwa słowniki
 * i rósłby przy każdej nowej grze.
 */
const KSZTALTY: Record<string, ReactNode> = {
  // Oko — symbol najwyższy, jedyny z wypełnioną źrenicą, żeby wyróżniał się
  // w rzędzie trzech konturów.
  oko: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    </>
  ),

  swieca: (
    <>
      <path d="M9.5 9h5v11h-5Z" />
      <path d="M12 9V6.5" />
      <path d="M12 6.5c1.6-1 1.6-2.6 0-4-1.6 1.4-1.6 3 0 4Z" />
      <path d="M8 20.5h8" />
    </>
  ),

  kielich: (
    <>
      <path d="M7 3.5h10l-1.2 6.2a4.3 4.3 0 0 1-7.6 0Z" />
      <path d="M12 13.5V20" />
      <path d="M8.5 20.5h7" />
    </>
  ),

  sztylet: (
    <>
      <path d="M12 21.5 9.6 8.5h4.8Z" />
      <path d="M7 8.5h10" />
      <path d="M12 8.5v-6" />
    </>
  ),

  pieczec: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6.5 15.2 17 12 14.4 8.8 17Z" />
    </>
  ),

  klucz: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M11.5 11 19 18.5" />
      <path d="M16.2 15.7l-2 2M19 18.5l-1.8 1.8" />
    </>
  ),
};

export function SymbolBebna({ symbol }: { symbol: string | null }) {
  const ksztalt = (symbol ? KSZTALTY[symbol] : undefined) ?? null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-10"
    >
      {/* Pusty bęben przed pierwszym spinem: kreska, nie brak. Puste miejsce
          wyglądałoby jak błąd wczytywania. */}
      {ksztalt ?? <path d="M7 12h10" />}
    </svg>
  );
}

/** Nazwy do czytnika ekranu — bębny same są `aria-hidden`. */
export const NAZWY_SYMBOLI: Record<string, string> = {
  oko: "Oko",
  swieca: "Świeca",
  kielich: "Kielich",
  sztylet: "Sztylet",
  pieczec: "Pieczęć",
  klucz: "Klucz",
};
