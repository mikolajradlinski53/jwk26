import Link from "next/link";

/**
 * Bingo i gra terenowa pod jednym przyciskiem w menu (2026-10-15): dwa
 * widoki tej samej zakładki. Zwykłe linki z `?widok=` - stan żyje w adresie,
 * więc powiadomienie o nowym zadaniu otwiera od razu właściwy widok.
 */
export function Przelacznik({ aktywny }: { aktywny: "bingo" | "gra" }) {
  const opcje = [
    { klucz: "bingo", nazwa: "Bingo", href: "/app/bingo" },
    { klucz: "gra", nazwa: "Gra terenowa", href: "/app/bingo?widok=gra" },
  ] as const;
  return (
    <nav aria-label="Bingo albo gra terenowa" className="szklo mb-4 grid grid-cols-2 gap-1 rounded-full p-1">
      {opcje.map((o) => (
        <Link
          key={o.klucz}
          href={o.href}
          replace
          aria-current={aktywny === o.klucz ? "page" : undefined}
          className={
            "grid min-h-10 place-items-center rounded-full text-sm font-bold transition-colors " +
            (aktywny === o.klucz ? "bg-krew text-white" : "text-dym")
          }
        >
          {o.nazwa}
        </Link>
      ))}
    </nav>
  );
}
