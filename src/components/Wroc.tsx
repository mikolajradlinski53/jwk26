import Link from "next/link";

/**
 * Link powrotu. Niesie typ przejścia `nav-back`, więc ekran odjeżdża w prawo —
 * odwrotnie niż przy wejściu głębiej (spec wyglądu, „Przejścia”).
 */
export function Wroc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      transitionTypes={["nav-back"]}
      className="mt-7 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
    >
      {children}
    </Link>
  );
}
