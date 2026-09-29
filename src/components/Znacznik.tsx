/** Krwista kapsuła z liczbą. Przy zerze nic nie rysuje. */
export function Znacznik({
  liczba,
  etykieta,
  className = "",
}: {
  liczba: number;
  etykieta: string;
  className?: string;
}) {
  if (liczba <= 0) return null;
  return (
    <span
      aria-label={etykieta}
      className={
        "grid h-5 min-w-5 flex-none place-items-center rounded-full bg-gradient-to-b from-krew to-krew-glab px-1.5 " +
        "text-[0.65rem] font-bold leading-none tabular-nums text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] " +
        className
      }
    >
      {liczba > 99 ? "99+" : liczba}
    </span>
  );
}
