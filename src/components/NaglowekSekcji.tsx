/** Nagłówek sekcji — ten sam wszędzie, żeby odstępy nie rozjeżdżały się między ekranami. */
export function NaglowekSekcji({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-8 px-1 text-xs uppercase tracking-[0.14em] text-dym">{children}</h2>
  );
}
