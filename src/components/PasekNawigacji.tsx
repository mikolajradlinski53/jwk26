"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Pozycja = { href: string; nazwa: string; ikona: React.ReactNode };

// Ikony rysowane w miejscu, bez biblioteki: pięć kształtów nie uzasadnia
// kolejnej zależności, a te muszą być czytelne przy 21 px.
const POZYCJE: Pozycja[] = [
  {
    href: "/",
    nazwa: "Ranking",
    ikona: <path d="M5 20v-6M12 20V5M19 20v-9" />,
  },
  {
    href: "/bingo",
    nazwa: "Bingo",
    ikona: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17" />
      </>
    ),
  },
  {
    href: "/feed",
    nazwa: "Feed",
    ikona: (
      <>
        <rect x="3" y="6" width="14" height="14" rx="3" />
        <path d="M7 3h11a3 3 0 0 1 3 3v11" />
      </>
    ),
  },
  {
    href: "/sklep",
    nazwa: "Sklep",
    ikona: (
      <>
        <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
  },
  {
    href: "/wiecej",
    nazwa: "Więcej",
    ikona: (
      <>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.8 20c1.3-3.6 4-5.4 7.2-5.4s5.9 1.8 7.2 5.4" />
      </>
    ),
  },
];

export function PasekNawigacji() {
  const sciezka = usePathname();

  return (
    <nav
      aria-label="Nawigacja główna"
      // Pasek pływa, nie dotyka krawędzi. To warunek działania szkła: docięty
      // do dołu nie ma pod sobą treści, więc rozmycie nie ma czego rozmywać.
      className="szklo fixed inset-x-3.5 bottom-[calc(0.875rem+env(safe-area-inset-bottom,0px))]
                 z-40 grid grid-cols-5 rounded-full p-1.5
                 shadow-[inset_0_1px_0_rgb(255_255_255/0.34),0_14px_34px_rgb(0_0_0/0.5)]"
    >
      {POZYCJE.map((p) => {
        // Ranking jest pod "/", więc dopasowanie po prefiksie zapaliłoby go
        // na każdej trasie. Dla reszty prefiks jest potrzebny, bo podstrony
        // panelu mają zapalać "Więcej".
        const aktywna =
          p.href === "/" ? sciezka === "/" : sciezka.startsWith(p.href);

        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={aktywna ? "page" : undefined}
            className={
              "relative grid min-h-11 place-items-center rounded-full transition-colors " +
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-krew " +
              (aktywna ? "text-white" : "text-dym hover:text-kosc")
            }
          >
            {aktywna && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0.5 inset-x-1.5 -z-10 rounded-full
                           bg-gradient-to-b from-krew to-krew-glab
                           shadow-[0_6px_18px_rgb(200_16_46/0.45),inset_0_1px_0_rgb(255_255_255/0.4)]"
              />
            )}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-[21px]"
            >
              {p.ikona}
            </svg>
            <span className="sr-only">{p.nazwa}</span>
          </Link>
        );
      })}
    </nav>
  );
}
