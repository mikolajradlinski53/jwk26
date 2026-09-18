/**
 * Dzielniki między sekcjami landingu — narzędzia "wyraźnego podziału"
 * z brifu, użyte naprzemiennie, żeby rytm nie był monotonny: fala rysowana
 * SVG-iem (nie obrazkiem), ukośna krawędź przez `clip-path` (patrz
 * globals.css), pasek z szewronem nawiązujący do strzałek z logotypu
 * i cienka linia z liściem pośrodku.
 *
 * Każdy dzielnik przyjmuje kolor przez klasę tekstową (`kolorKlasa`, np.
 * "text-jesien-karta") i maluje nim przez `fill="currentColor"` albo
 * `background: currentColor` — bez powielania wartości barw w kilku miejscach.
 */

export function DzielnikFala({
  kolorKlasa,
  tloKlasa = "",
}: {
  /** Klasa koloru tekstu — staje się kolorem wypełnienia fali. */
  kolorKlasa: string;
  /** Opcjonalne tło elementu-nosiciela, gdy fala ma "wypływać" z innego koloru. */
  tloKlasa?: string;
}) {
  return (
    <div className={`relative h-12 w-full overflow-hidden min-[600px]:h-16 ${tloKlasa}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 74"
        preserveAspectRatio="none"
        className={`absolute inset-0 h-full w-full ${kolorKlasa}`}
      >
        <path
          fill="currentColor"
          d="M0,32 C240,74 480,0 720,24 C960,48 1200,74 1440,32 L1440,74 L0,74 Z"
        />
      </svg>
    </div>
  );
}

/** Trzy szewrony — powtórzenie strzałek z logotypu jako motyw przewodni. */
function Szewrony() {
  return (
    <svg viewBox="0 0 54 20" className="h-3 w-8 text-jesien-rdza" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M2 3 L12 10 L2 17" />
        <path d="M21 3 L31 10 L21 17" />
        <path d="M40 3 L50 10 L40 17" />
      </g>
    </svg>
  );
}

export function DzielnikSzewron() {
  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-4 px-4 py-2" aria-hidden="true">
      <div className="h-px flex-1 bg-jesien-kora/20" />
      <Szewrony />
      <div className="h-px flex-1 bg-jesien-kora/20" />
    </div>
  );
}

/** Cienka linia z liściem pośrodku — echo kanwy `Liscie` w statycznej formie. */
export function DzielnikLisc() {
  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-4 px-4 py-2" aria-hidden="true">
      <div className="h-px flex-1 bg-jesien-kora/20" />
      <svg viewBox="0 0 24 24" className="size-4 text-jesien-mech" fill="currentColor">
        <path d="M12 2c5 3 8 7 8 12a8 8 0 0 1-16 0c0-5 3-9 8-12Z" opacity="0.8" />
        <path d="M12 4v16" stroke="rgb(0 0 0 / 0.25)" strokeWidth="0.8" fill="none" />
      </svg>
      <div className="h-px flex-1 bg-jesien-kora/20" />
    </div>
  );
}

/**
 * Ukośna krawędź. `kolorKlasa` maluje klin (kolor sekcji, która następuje),
 * `tloKlasa` to tło paska-nosiciela (kolor sekcji, która się kończy) —
 * dokładnie tak samo jak przy fali, tylko kształt inny (patrz `.dzielnik-skos`
 * w globals.css).
 */
export function DzielnikSkos({
  kolorKlasa,
  tloKlasa,
}: {
  kolorKlasa: string;
  tloKlasa: string;
}) {
  return (
    <div className={`h-10 w-full min-[600px]:h-14 ${tloKlasa}`} aria-hidden="true">
      <div className={`dzielnik-skos h-full w-full ${kolorKlasa}`} />
    </div>
  );
}
