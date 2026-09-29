import Link from "next/link";
import { Ikona, type NazwaIkony } from "./Ikona";

/**
 * Wiersz menu: ikona, nazwa, opis, opcjonalnie licznik po prawej. Wspólny dla
 * „Więcej”, Sanktuarium i kasyna — ten sam kształt wszędzie, jedna zmiana
 * obejmuje wszystkie trzy. Linki wewnętrzne niosą przejście „w głąb”.
 */
export function PozycjaMenu({
  href,
  ikona,
  nazwa,
  opis,
  licznik,
  zewnetrzny = false,
}: {
  href: string;
  ikona: NazwaIkony;
  nazwa: string;
  opis?: string;
  licznik?: React.ReactNode;
  /** `mailto:` i adresy spoza apki — zwykły <a>, bez przejścia. */
  zewnetrzny?: boolean;
}) {
  // `min-w-0`: w siatce element domyślnie rośnie do szerokości treści, więc
  // długi opis (adres mailowy) wypychał wiersz poza ekran zamiast się uciąć.
  const klasy =
    "szklo flex min-h-14 min-w-0 items-center gap-3 rounded-md px-4 py-3 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew";
  const tresc = (
    <>
      <Ikona nazwa={ikona} className="size-10 flex-none text-kosc" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{nazwa}</span>
        {opis && <span className="block truncate text-xs text-dym">{opis}</span>}
      </span>
      {licznik}
    </>
  );
  return zewnetrzny ? (
    <a href={href} className={klasy}>
      {tresc}
    </a>
  ) : (
    <Link href={href} transitionTypes={["nav-forward"]} className={klasy}>
      {tresc}
    </Link>
  );
}
