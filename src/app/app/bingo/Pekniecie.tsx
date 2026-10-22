/**
 * Pęknięty kafel zaliczonego pola bingo (2026-10-22, „bardziej realistycznie”).
 *
 * Jak szkło albo glazura po uderzeniu: punkt uderzenia, promieniste pęknięcia
 * do krawędzi, pajęczyna spękań poprzecznych i lekko inaczej oświetlone
 * odłamane płaszczyzny. Każde pęknięcie to ciemna szczelina z jasną krawędzią
 * obok (światło na krawędzi odłamu) - bez tej pary wyglądało jak narysowana
 * kreska. Ścieżki zaczynają się w punkcie uderzenia, więc animacja dashoffset
 * „rośnie” od niego na zewnątrz. Klasa `skreslenie-rysuj` (dokładana raz,
 * przy pierwszym zobaczeniu zaliczenia) uruchamia animację w globals.css.
 */

const UDERZENIE = { x: 64, y: 36 };

// Promieniste - od punktu uderzenia do krawędzi, postrzępione.
const PROMIENIE = [
  "M64 36 L55 30 L47 31 L36 22 L28 21 L14 8 L3 1",
  "M64 36 L66 26 L62 17 L67 8 L65 0",
  "M64 36 L74 31 L82 33 L91 24 L100 21",
  "M64 36 L73 42 L84 41 L92 50 L100 53",
  "M64 36 L68 49 L76 60 L80 74 L90 88 L95 100",
  "M64 36 L58 50 L60 63 L52 76 L54 90 L49 100",
  "M64 36 L52 42 L41 47 L33 58 L20 66 L10 79 L0 87",
];

// Poprzeczne - pajęczyna wokół uderzenia, krótsze i cieńsze.
const PIERSCIENIE = [
  "M55 30 L63 25 L73 31 L72 42 L64 46 L54 42",
  "M47 31 L61 18 L81 33 L84 41",
  "M41 47 L58 54 L59 61 L74 58",
  "M28 21 L36 22 L37 13",
];

// Odłamane płaszczyzny - przy uderzeniu, każda trochę inaczej oświetlona.
const PLASZCZYZNY: { punkty: string; jasna: boolean; krycie: number }[] = [
  { punkty: "64,36 55,30 63,25", jasna: true, krycie: 0.16 },
  { punkty: "64,36 63,25 73,31", jasna: false, krycie: 0.14 },
  { punkty: "64,36 73,31 72,42", jasna: true, krycie: 0.1 },
  { punkty: "64,36 72,42 64,46", jasna: false, krycie: 0.2 },
  { punkty: "64,36 64,46 54,42", jasna: true, krycie: 0.12 },
  { punkty: "64,36 54,42 55,30", jasna: false, krycie: 0.1 },
  { punkty: "47,31 61,18 63,25 55,30", jasna: false, krycie: 0.08 },
  { punkty: "73,42 84,41 81,33 73,31", jasna: true, krycie: 0.07 },
];

// Odłamki odpryskujące z punktu uderzenia (widać je tylko w animacji).
const ODLAMKI: { punkty: string; dx: number; dy: number }[] = [
  { punkty: "62,33 66,31 65,37", dx: -16, dy: -14 },
  { punkty: "66,35 70,36 67,40", dx: 17, dy: -9 },
  { punkty: "61,37 64,39 60,41", dx: -13, dy: 13 },
  { punkty: "65,38 69,40 66,43", dx: 11, dy: 16 },
  { punkty: "63,32 65,30 66,34", dx: 4, dy: -19 },
];

function Szczelina({ d, gruba }: { d: string; gruba: boolean }) {
  return (
    <>
      {/* Jasna krawędź odłamu, przesunięta o włos względem szczeliny. */}
      <path
        className="pekniecie"
        d={d}
        pathLength={100}
        transform="translate(0.7 0.7)"
        fill="none"
        stroke="rgb(255 240 236 / 0.55)"
        strokeWidth={gruba ? 1 : 0.7}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Ciemna szczelina. */}
      <path
        className="pekniecie"
        d={d}
        pathLength={100}
        fill="none"
        stroke="rgb(28 4 8 / 0.82)"
        strokeWidth={gruba ? 1.7 : 1.1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

export function Pekniecie() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="skreslenie pointer-events-none absolute inset-0 overflow-visible rounded-sm"
    >
      <g className="plaszczyzny">
        {PLASZCZYZNY.map((p) => (
          <polygon
            key={p.punkty}
            points={p.punkty}
            fill={p.jasna ? `rgb(255 255 255 / ${p.krycie})` : `rgb(0 0 0 / ${p.krycie})`}
          />
        ))}
      </g>
      {PROMIENIE.map((d, i) => (
        <g key={d} className="promien" style={{ ["--kolejnosc" as string]: i }}>
          <Szczelina d={d} gruba />
        </g>
      ))}
      {PIERSCIENIE.map((d, i) => (
        <g key={d} className="pierscien" style={{ ["--kolejnosc" as string]: i }}>
          <Szczelina d={d} gruba={false} />
        </g>
      ))}
      {/* Krater uderzenia: ciemny środek, jasny pierścień odbitego światła. */}
      <g className="krater">
        <circle cx={UDERZENIE.x} cy={UDERZENIE.y} r={2.4} fill="rgb(28 4 8 / 0.7)" />
      <circle
        cx={UDERZENIE.x}
        cy={UDERZENIE.y}
        r={4.2}
        fill="none"
        stroke="rgb(255 240 236 / 0.4)"
        strokeWidth={0.8}
        vectorEffect="non-scaling-stroke"
      />
      </g>
      <circle className="blysk-uderzenia" cx={UDERZENIE.x} cy={UDERZENIE.y} r={10} fill="rgb(255 245 240 / 0.9)" />
      {ODLAMKI.map((o) => (
        <polygon
          key={o.punkty}
          className="odlamek"
          points={o.punkty}
          fill="rgb(232 32 60)"
          stroke="rgb(255 240 236 / 0.7)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
          style={{ ["--dx" as string]: `${o.dx}px`, ["--dy" as string]: `${o.dy}px` }}
        />
      ))}
    </svg>
  );
}
