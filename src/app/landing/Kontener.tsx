/**
 * Wspólna szerokość treści landinga.
 *
 * Na telefonie zostaje wąska kolumna, bo tak czyta się najlepiej i tak samo
 * zachowuje się apka. Na większych ekranach musi oddychać: przy stałym
 * `max-w-md` landing był kolumną 448 px pośrodku monitora, podczas gdy karta
 * stopki ma 1000 px — wyglądało to jak strona w połowie zbudowana.
 *
 * Szerokość nie jest jedna dla wszystkiego, bo różne rzeczy mają różne
 * potrzeby:
 *
 * - `tekst` zatrzymuje się na 65 znakach. Akapit rozciągnięty na 1000 px
 *   czyta się fatalnie — oko gubi początek następnego wiersza.
 * - `szeroki` służy galeriom, zdjęciom i wszystkiemu, co zyskuje na
 *   powierzchni. Zrównany ze stopką, żeby krawędzie się pokrywały.
 */
export function Kontener({
  wariant = "tekst",
  className = "",
  children,
}: {
  wariant?: "tekst" | "szeroki";
  className?: string;
  children: React.ReactNode;
}) {
  const szerokosc =
    wariant === "szeroki"
      ? "max-w-md min-[850px]:max-w-[1000px]"
      : "max-w-md min-[850px]:max-w-[65ch]";

  return <div className={`mx-auto w-full ${szerokosc} ${className}`}>{children}</div>;
}
