"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ZdjecieDane = {
  plik: string;
  szerokosc: number;
  wysokosc: number;
  etykieta: string;
  alt: string;
};

/**
 * Siedem zdjęć z poprzednich edycji, wybrane po obejrzeniu całego zestawu
 * `public/hero/hero-1..10`. Trzy pominięte celowo:
 *
 * - `hero-1` — wypalona data „25 10 2025" w kadrze i rozebrany uczestnik
 *   w żartobliwej pozie na ławce. Nie nadaje się na oficjalny landing.
 * - `hero-3` — najciemniejsze z całego zestawu (jasność 19/255) i dodatkowo
 *   kompozycję zjada dłoń z zegarkiem wepchnięta tuż przed obiektyw.
 *   `hero-4` jest niemal równie ciemne (28/255), ale bez tej wady kadru,
 *   więc zostaje — jako jedyny nocny akcent poza `hero-2`.
 * - `hero-8` — już zajęte: to zdjęcie hero na samej górze strony
 *   (`Wejscie.tsx`). Powtórzenie go w galerii, którą widać kilka sekcji
 *   niżej na tej samej stronie, tylko zabierałoby miejsce jednemu z siedmiu
 *   unikalnych kadrów.
 *
 * Kolejność: dzień na start (`hero-7`, `hero-6`), potem wnętrza i wieczory,
 * kończąc na dwóch najciemniejszych ujęciach — naturalny łuk od jasnego
 * do nocnego nastroju, nie przypadkowa kolejność plików.
 */
const ZDJECIA: ZdjecieDane[] = [
  {
    plik: "hero-7",
    szerokosc: 1781,
    wysokosc: 1800,
    etykieta: "Na polu",
    alt: "Duża grupa uczestników pozuje na polnej drodze wśród ściernisk, w słoneczny dzień pod błękitnym niebem",
  },
  {
    plik: "hero-6",
    szerokosc: 1350,
    wysokosc: 1800,
    etykieta: "Jesienne wzgórza",
    alt: "Dwóch uczestników rozmawia na wzgórzu, w tle góry pokryte jesiennym lasem",
  },
  {
    plik: "hero-9",
    szerokosc: 1800,
    wysokosc: 1013,
    etykieta: "Wieczorna sala",
    alt: "Duża grupa uczestników poprzedniej edycji pozuje razem we wspólnej sali ośrodka",
  },
  {
    plik: "hero-5",
    szerokosc: 1350,
    wysokosc: 1800,
    etykieta: "Przebranie",
    alt: "Troje uczestników w strojach na tematyczną imprezę pozuje z butelkami oranżady",
  },
  {
    plik: "hero-10",
    szerokosc: 1350,
    wysokosc: 1800,
    etykieta: "Wieczorna zabawa",
    alt: "Dwoje uczestników w opaskach z uszami pozuje razem na wieczornej imprezie",
  },
  {
    plik: "hero-2",
    szerokosc: 1800,
    wysokosc: 1350,
    etykieta: "Ekipa",
    alt: "Trzy uczestniczki w kapturach uśmiechają się wieczorem przed budynkiem ośrodka",
  },
  {
    plik: "hero-4",
    szerokosc: 1800,
    wysokosc: 1350,
    etykieta: "Poprzednie lata",
    alt: "Troje uczestników uśmiecha się na wspólnym zdjęciu zrobionym wieczorem",
  },
];

// Ile kafelków widać, zanim ktoś kliknie „Pokaż więcej". Siedem zdjęć w
// siatce murowanej (2 kolumny na telefonie) to już cztery-pięć rzędów —
// właściciel wcześniej skarżył się, że galeria „przykrywa swoją objętością
// treść", więc na start widać tylko pięć, reszta doczytuje się na żądanie.
const WIDOCZNE_NA_START = 5;

/**
 * Galeria zdjęć z poprzednich edycji — murowana siatka (CSS `columns`),
 * nie sztywne kafelki 4:3. Cztery z siedmiu zdjęć są pionowe albo prawie
 * kwadratowe (patrz `ZDJECIA`); wymuszenie ich w jeden kształt obcinałoby
 * głowy, więc każdy kafelek dostaje własny `aspect-ratio` policzony
 * z prawdziwych wymiarów pliku i **nic nie jest kadrowane**.
 *
 * `columns-2` do `min-[1200px]:columns-4`: ta sama siatka na telefonie
 * i na desktopie, tylko liczba kolumn rośnie z szerokością ekranu — na
 * dużym monitorze faktycznie wykorzystuje szerokość zamiast wyglądać jak
 * powiększony widok telefonu (dawna talia 3D w `TaliaKart.tsx` miała
 * dokładnie tę wadę: jeden układ, myślany pod telefon, tylko rozciągnięty).
 * `break-inside-avoid-column` pilnuje, żeby żaden kafelek nie rozłamał się
 * w połowie na granicy kolumny.
 *
 * Kliknięcie/Enter na kafelku otwiera lightbox z większym podglądem —
 * Escape zamyka, focus po otwarciu ląduje na przycisku zamknięcia, po
 * zamknięciu wraca na kafelek, który go otworzył. Strzałki lewo/prawo
 * przełączają zdjęcie w lightboksie.
 *
 * `react-hooks/set-state-in-effect` jest w tym repo twardym błędem: jedyne
 * wywołania `setOtwarteIndeks`/`setRozwinieta` poniżej siedzą w callbackach
 * zdarzeń (klik, `keydown`), nigdy w ciele efektu.
 */
export function Galeria() {
  const [rozwinieta, setRozwinieta] = useState(false);
  const [otwarteIndeks, setOtwarteIndeks] = useState<number | null>(null);
  const kafelkiRefy = useRef<(HTMLButtonElement | null)[]>([]);
  const zamknijRef = useRef<HTMLButtonElement | null>(null);
  const ostatniFokusRef = useRef<HTMLButtonElement | null>(null);

  const widoczne = rozwinieta ? ZDJECIA : ZDJECIA.slice(0, WIDOCZNE_NA_START);

  useEffect(() => {
    if (otwarteIndeks === null) return;

    zamknijRef.current?.focus();

    // Blokada przewijania strony pod lightboksem — przywrócona w sprzątaniu
    // efektu, więc znika razem z zamknięciem albo odmontowaniem.
    const poprzednieOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function naKlawisz(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOtwarteIndeks(null);
        ostatniFokusRef.current?.focus();
      } else if (event.key === "ArrowRight") {
        setOtwarteIndeks((i) => (i === null ? i : (i + 1) % widoczne.length));
      } else if (event.key === "ArrowLeft") {
        setOtwarteIndeks((i) => (i === null ? i : (i - 1 + widoczne.length) % widoczne.length));
      }
    }

    document.addEventListener("keydown", naKlawisz);
    return () => {
      document.body.style.overflow = poprzednieOverflow;
      document.removeEventListener("keydown", naKlawisz);
    };
  }, [otwarteIndeks, widoczne.length]);

  function otworz(i: number) {
    ostatniFokusRef.current = kafelkiRefy.current[i];
    setOtwarteIndeks(i);
  }

  function zamknij() {
    setOtwarteIndeks(null);
    ostatniFokusRef.current?.focus();
  }

  const aktywne = otwarteIndeks !== null ? widoczne[otwarteIndeks] : null;

  return (
    <div>
      <div
        role="group"
        aria-label="Galeria zdjęć z poprzednich edycji"
        className="columns-2 gap-3 min-[850px]:columns-3 min-[1200px]:columns-4"
      >
        {widoczne.map((zdjecie, i) => (
          <button
            key={zdjecie.plik}
            type="button"
            ref={(el) => {
              kafelkiRefy.current[i] = el;
            }}
            onClick={() => otworz(i)}
            aria-label={`Powiększ zdjęcie: ${zdjecie.alt}`}
            className="group mb-3 block w-full break-inside-avoid-column overflow-hidden rounded-lg
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
          >
            <span
              className="relative block w-full bg-jesien-kora/10"
              style={{ aspectRatio: `${zdjecie.szerokosc} / ${zdjecie.wysokosc}` }}
            >
              <Image
                src={`/hero/${zdjecie.plik}.jpg`}
                alt={zdjecie.alt}
                fill
                loading={i < 2 ? "eager" : "lazy"}
                sizes="(min-width: 1200px) 235px, (min-width: 850px) 30vw, (min-width: 480px) 215px, 46vw"
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
              />
            </span>
          </button>
        ))}
      </div>

      {ZDJECIA.length > WIDOCZNE_NA_START && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setRozwinieta((r) => !r)}
            aria-expanded={rozwinieta}
            className="rounded-md border border-jesien-kora/25 bg-jesien-tlo px-5 py-2 text-sm font-bold text-jesien-rdza
                       transition hover:bg-jesien-karta focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-jesien-rdza"
          >
            {rozwinieta ? "Pokaż mniej" : `Pokaż więcej zdjęć (+${ZDJECIA.length - WIDOCZNE_NA_START})`}
          </button>
        </div>
      )}

      {aktywne && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-jesien-atrament/90 p-4"
          onClick={zamknij}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={aktywne.etykieta}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-w-[92vw] flex-col items-center min-[850px]:max-w-[900px]"
          >
            <button
              type="button"
              ref={zamknijRef}
              onClick={zamknij}
              aria-label="Zamknij podgląd"
              className="absolute -top-3 -right-3 z-10 grid size-9 place-items-center rounded-full bg-jesien-tlo
                         text-jesien-atrament shadow-md focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-jesien-rdza"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
                <path
                  d="M4 4l12 12M16 4L4 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>

            <Image
              src={`/hero/${aktywne.plik}.jpg`}
              alt={aktywne.alt}
              width={aktywne.szerokosc}
              height={aktywne.wysokosc}
              sizes="90vw"
              className="max-h-[80vh] max-w-[92vw] rounded-lg object-contain min-[850px]:max-w-[900px]"
            />
            <p className="mt-2 text-center text-xs text-jesien-tlo/90">{aktywne.etykieta}</p>
          </div>
        </div>
      )}
    </div>
  );
}
