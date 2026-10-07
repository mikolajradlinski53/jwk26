"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ZdjecieDane = {
  plik: string;
  szerokosc: number;
  wysokosc: number;
};

/**
 * Zdjęcia z poprzednich edycji. Z pierwszego zestawu (`public/hero/hero-1..10`)
 * dwa pominięte celowo:
 *
 * - `hero-1` - wypalona data „25 10 2025" w kadrze i rozebrany uczestnik
 *   w żartobliwej pozie na ławce. Nie nadaje się na oficjalny landing.
 * - `hero-3` - najciemniejsze z całego zestawu (jasność 19/255) i dodatkowo
 *   kompozycję zjada dłoń z zegarkiem wepchnięta tuż przed obiektyw.
 *   `hero-4` jest niemal równie ciemne (28/255), ale bez tej wady kadru,
 *   więc zostaje - jako jedyny nocny akcent poza `hero-2`.
 *
 * 2026-10-05 doszło `hero-8` (dotąd tło hero, teraz hero ma placeholder)
 * i pięć zdjęć od Mikołaja: `hero-20`, `-21`, `-22`, `-23`, `-25`.
 *
 * Bez opisów (alt i podpisy) - decyzja Mikołaja 2026-10-05; zdjęcia są
 * dekoracją galerii, kafelek ma tylko etykietę „Powiększ zdjęcie N”.
 *
 * Kolejność: na start cztery najmocniejsze dzienne kadry grupowe, potem
 * wnętrza i wieczory, kończąc na dwóch najciemniejszych ujęciach - naturalny
 * łuk od jasnego do nocnego nastroju, nie przypadkowa kolejność plików.
 */
const ZDJECIA: ZdjecieDane[] = [
  { plik: "hero-8", szerokosc: 1800, wysokosc: 1350 },
  { plik: "hero-7", szerokosc: 1781, wysokosc: 1800 },
  { plik: "hero-20", szerokosc: 1350, wysokosc: 1800 },
  { plik: "hero-25", szerokosc: 1800, wysokosc: 1350 },
  { plik: "hero-6", szerokosc: 1350, wysokosc: 1800 },
  { plik: "hero-21", szerokosc: 1350, wysokosc: 1800 },
  { plik: "hero-9", szerokosc: 1800, wysokosc: 1013 },
  { plik: "hero-22", szerokosc: 1800, wysokosc: 1350 },
  { plik: "hero-5", szerokosc: 1350, wysokosc: 1800 },
  { plik: "hero-10", szerokosc: 1350, wysokosc: 1800 },
  { plik: "hero-23", szerokosc: 1350, wysokosc: 1800 },
  { plik: "hero-2", szerokosc: 1800, wysokosc: 1350 },
  { plik: "hero-4", szerokosc: 1800, wysokosc: 1350 },
];

// Ile kafelków widać, zanim ktoś kliknie „Pokaż więcej". Galeria nie może
// „przykrywać objętością treści” (uwaga właściciela), więc na start cztery:
// na telefonie dwa rzędy po dwa, na komputerze jeden pełny rząd - przy pięciu
// piąte zdjęcie wisiało samo pod spodem.
const WIDOCZNE_NA_START = 4;

/**
 * Galeria zdjęć z poprzednich edycji - murowana siatka (CSS `columns`),
 * nie sztywne kafelki 4:3. Większość zdjęć jest pionowa albo prawie
 * kwadratowa (patrz `ZDJECIA`); wymuszenie ich w jeden kształt obcinałoby
 * głowy, więc każdy kafelek dostaje własny `aspect-ratio` policzony
 * z prawdziwych wymiarów pliku i **nic nie jest kadrowane**.
 *
 * `columns-2` do `min-[1200px]:columns-4`: ta sama siatka na telefonie
 * i na desktopie, tylko liczba kolumn rośnie z szerokością ekranu - na
 * dużym monitorze faktycznie wykorzystuje szerokość zamiast wyglądać jak
 * powiększony widok telefonu (dawna talia 3D w `TaliaKart.tsx` miała
 * dokładnie tę wadę: jeden układ, myślany pod telefon, tylko rozciągnięty).
 * `break-inside-avoid-column` pilnuje, żeby żaden kafelek nie rozłamał się
 * w połowie na granicy kolumny.
 *
 * Kliknięcie/Enter na kafelku otwiera lightbox z większym podglądem -
 * Escape zamyka, focus po otwarciu ląduje na przycisku zamknięcia, po
 * zamknięciu wraca na kafelek, który go otworzył. W lightboksie chodzi się
 * po wszystkich zdjęciach (także schowanych pod „Pokaż więcej”): strzałkami
 * na klawiaturze, przyciskami po bokach albo przesunięciem palcem - zdjęcie
 * jedzie za palcem, a puszczone dalej niż `PROG_PRZESUNIECIA` przeskakuje
 * na następne. `touch-action: pan-y pinch-zoom` oddaje nam ruch poziomy,
 * a przybliżanie dwoma palcami zostawia przeglądarce.
 *
 * `react-hooks/set-state-in-effect` jest w tym repo twardym błędem: wszystkie
 * wywołania `set…` poniżej siedzą w callbackach zdarzeń (klik, `keydown`,
 * dotyk), nigdy w ciele efektu.
 */
const PROG_PRZESUNIECIA = 50;

function Strzalka({ kierunek, onClick }: { kierunek: "lewo" | "prawo"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={kierunek === "lewo" ? "Poprzednie zdjęcie" : "Następne zdjęcie"}
      className={`absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-jesien-tlo/85
                  text-jesien-atrament shadow-md transition hover:bg-jesien-tlo focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza
                  ${kierunek === "lewo" ? "left-2" : "right-2"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
        <path
          d={kierunek === "lewo" ? "M12.5 4.5L7 10l5.5 5.5" : "M7.5 4.5L13 10l-5.5 5.5"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
}

export function Galeria() {
  const [rozwinieta, setRozwinieta] = useState(false);
  const [otwarteIndeks, setOtwarteIndeks] = useState<number | null>(null);
  const [przesuniecie, setPrzesuniecie] = useState(0);
  const kafelkiRefy = useRef<(HTMLButtonElement | null)[]>([]);
  const zamknijRef = useRef<HTMLButtonElement | null>(null);
  const ostatniFokusRef = useRef<HTMLButtonElement | null>(null);
  const dotykRef = useRef<{ x: number; y: number; poziomo: boolean | null } | null>(null);

  const widoczne = rozwinieta ? ZDJECIA : ZDJECIA.slice(0, WIDOCZNE_NA_START);
  const ile = ZDJECIA.length;

  useEffect(() => {
    if (otwarteIndeks === null) return;

    zamknijRef.current?.focus();

    // Blokada przewijania strony pod lightboksem - przywrócona w sprzątaniu
    // efektu, więc znika razem z zamknięciem albo odmontowaniem.
    const poprzednieOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function naKlawisz(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOtwarteIndeks(null);
        ostatniFokusRef.current?.focus();
      } else if (event.key === "ArrowRight") {
        setOtwarteIndeks((i) => (i === null ? i : (i + 1) % ile));
      } else if (event.key === "ArrowLeft") {
        setOtwarteIndeks((i) => (i === null ? i : (i - 1 + ile) % ile));
      }
    }

    document.addEventListener("keydown", naKlawisz);
    return () => {
      document.body.style.overflow = poprzednieOverflow;
      document.removeEventListener("keydown", naKlawisz);
    };
  }, [otwarteIndeks, ile]);

  function otworz(i: number) {
    ostatniFokusRef.current = kafelkiRefy.current[i];
    setOtwarteIndeks(i);
  }

  function zamknij() {
    setOtwarteIndeks(null);
    ostatniFokusRef.current?.focus();
  }

  function przesun(o: number) {
    setPrzesuniecie(0);
    setOtwarteIndeks((i) => (i === null ? i : (i + o + ile) % ile));
  }

  function naStartDotyku(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    dotykRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, poziomo: null };
  }

  function naRuchDotyku(e: React.TouchEvent) {
    const d = dotykRef.current;
    if (!d || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - d.x;
    const dy = e.touches[0].clientY - d.y;
    // Kierunek ustalany raz, po pierwszych kilku pikselach - ruch w pionie
    // nie przesuwa zdjęcia na boki.
    if (d.poziomo === null && Math.abs(dx) + Math.abs(dy) > 8) d.poziomo = Math.abs(dx) > Math.abs(dy);
    if (d.poziomo) setPrzesuniecie(dx);
  }

  function naKoniecDotyku() {
    const d = dotykRef.current;
    dotykRef.current = null;
    if (d?.poziomo && Math.abs(przesuniecie) > PROG_PRZESUNIECIA) przesun(przesuniecie < 0 ? 1 : -1);
    else setPrzesuniecie(0);
  }

  const aktywne = otwarteIndeks !== null ? ZDJECIA[otwarteIndeks] : null;

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
            aria-label={`Powiększ zdjęcie ${i + 1}`}
            className="group mb-3 block w-full break-inside-avoid-column overflow-hidden rounded-lg
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
          >
            <span
              className="relative block w-full bg-jesien-kora/10"
              style={{ aspectRatio: `${zdjecie.szerokosc} / ${zdjecie.wysokosc}` }}
            >
              <Image
                src={`/hero/${zdjecie.plik}.jpg`}
                alt=""
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

      {aktywne && otwarteIndeks !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-jesien-atrament/90 p-4
                     [touch-action:pan-y_pinch-zoom]"
          onClick={zamknij}
          onTouchStart={naStartDotyku}
          onTouchMove={naRuchDotyku}
          onTouchEnd={naKoniecDotyku}
          onTouchCancel={naKoniecDotyku}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Podgląd zdjęcia ${otwarteIndeks + 1} z ${ile}`}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-w-[92vw] flex-col items-center min-[850px]:max-w-[900px]"
          >
            <button
              type="button"
              ref={zamknijRef}
              onClick={zamknij}
              aria-label="Zamknij podgląd"
              className="absolute -top-3 -right-3 z-20 grid size-9 place-items-center rounded-full bg-jesien-tlo
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

            <Strzalka kierunek="lewo" onClick={() => przesun(-1)} />
            <Strzalka kierunek="prawo" onClick={() => przesun(1)} />

            <Image
              key={aktywne.plik}
              src={`/hero/${aktywne.plik}.jpg`}
              alt=""
              width={aktywne.szerokosc}
              height={aktywne.wysokosc}
              sizes="90vw"
              draggable={false}
              style={{ transform: `translateX(${przesuniecie}px)` }}
              className={`max-h-[80vh] max-w-[92vw] select-none rounded-lg object-contain min-[850px]:max-w-[900px]
                          ${przesuniecie === 0 ? "transition-transform duration-200 ease-out" : ""}`}
            />
            <p aria-hidden="true" className="mt-2 text-xs tabular-nums text-jesien-tlo/80">
              {otwarteIndeks + 1} / {ile}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
