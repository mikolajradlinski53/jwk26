import Link from "next/link";

/**
 * Link powrotu. Niesie typ przejścia `nav-back`, więc ekran odjeżdża w prawo —
 * odwrotnie niż przy wejściu głębiej (spec wyglądu, „Przejścia”).
 *
 * Kapsuła z płynnego szkła ze strzałką, nie goły napis: szary, rozstrzelony
 * tekst ginął na tle Dym (uwaga Mikołaja). Jeden komponent — zmiana obejmuje
 * wszystkie ekrany naraz.
 */
export function Wroc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-7 flex justify-center">
      <Link
        href={href}
        transitionTypes={["nav-back"]}
        className="szklo-plynne inline-flex min-h-11 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-bold
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4"
        >
          <path d="M15 5 8 12l7 7" />
        </svg>
        {children}
      </Link>
    </div>
  );
}
