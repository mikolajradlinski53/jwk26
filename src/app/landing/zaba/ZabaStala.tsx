import { stylKlatki } from "./sprite";

/**
 * Żaba w stałym miejscu: siedzi i macha w hero (dwie klatki na zmianę,
 * animacja CSS `.zaba-machanie` — globalna reguła ograniczonego ruchu ją
 * zatrzymuje) albo trzyma ramkę filmu w Zapowiedzi (jedna klatka).
 * Dekoracja: `aria-hidden`.
 */
export function ZabaStala({
  poza,
  skala = 1,
  className = "",
}: {
  poza: "siedzi" | "ramka";
  skala?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${poza === "siedzi" ? "zaba-machanie" : ""} pointer-events-none select-none ${className}`}
      style={stylKlatki(poza, 0, skala)}
    />
  );
}
