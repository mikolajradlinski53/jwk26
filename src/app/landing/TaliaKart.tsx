"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type KartaDane = {
  plik: string;
  etykieta: string;
  alt: string;
};

// Trzy zdjęcia z poprzednich edycji, wybrane po obejrzeniu całego zestawu
// w `public/hero/`. Pominięte celowo: `hero-1` (wypalona data „25 10 2025"
// i rozebrany uczestnik w żartobliwej pozie na ławce — nie nadaje się na
// landing), `hero-3` (bardzo ciemne, kompozycję dodatkowo zjada dłoń
// wepchnięta tuż przed obiektyw). Etykiety neutralne, bez nawiązań do
// motywu apki.
const KARTY: KartaDane[] = [
  {
    plik: "hero-2",
    etykieta: "Ekipa",
    alt: "Trzy uczestniczki poprzedniej edycji w kurtkach z kapturami, uśmiechnięte wieczorem przed budynkiem ośrodka",
  },
  {
    plik: "hero-4",
    etykieta: "Poprzednie lata",
    alt: "Troje uczestników poprzedniej edycji uśmiecha się na wspólnym zdjęciu zrobionym wieczorem",
  },
  {
    plik: "hero-10",
    etykieta: "Zabawa",
    alt: "Dwoje uczestników poprzedniej edycji pozuje do zdjęcia podczas wieczornej zabawy w sali ośrodka",
  },
];

// Pozycje w stanie otwartym: rozsunięcie (% szerokości własnej karty),
// głębia bazowa (translateZ, px) — patrz też CLOSED_* niżej dla stanu
// zamkniętego. Wartości z brifu.
const SPREAD = [-34, 0, 34];
const OPEN_DEPTH = [24, 0, -24];
const CLOSED_LIFT = [0, -10.5, -21];
const CLOSED_DEPTH = [0, -9, -18];
const CLOSED_BRIGHT = [1, 0.92, 0.84];

// Sprężyny (stiffness/damping), nazwane jak w brifie.
const SPR_ROZSUNIECIE: [number, number] = [145, 21];
const SPR_GLEBIA_PRZECHYL: [number, number] = [110, 19];
const SPR_AKTYWNA: [number, number] = [210, 25];

type Kanal = { v: number; vel: number };

function nowyKanal(v: number): Kanal {
  return { v, vel: 0 };
}

/** Krok prostej fizyki sprężyny (masa=1), z opcją natychmiastowego zatrzaśnięcia na cel. */
function krokSprezyny(k: Kanal, cel: number, sztywnosc: number, tlumienie: number, dt: number, snap: boolean) {
  if (snap) {
    k.v = cel;
    k.vel = 0;
    return;
  }
  const przyspieszenie = sztywnosc * (cel - k.v) - tlumienie * k.vel;
  k.vel += przyspieszenie * dt;
  k.v += k.vel * dt;
}

type FizykaKarty = {
  spread: Kanal;
  lift: Kanal;
  depth: Kanal;
  rotY: Kanal;
  rotZ: Kanal;
  scale: Kanal;
  bright: Kanal;
};

function poczatkowaFizyka(i: number): FizykaKarty {
  return {
    spread: nowyKanal(0),
    lift: nowyKanal(CLOSED_LIFT[i]),
    depth: nowyKanal(CLOSED_DEPTH[i]),
    rotY: nowyKanal(0),
    rotZ: nowyKanal(0),
    scale: nowyKanal(1),
    bright: nowyKanal(CLOSED_BRIGHT[i]),
  };
}

const MAX_DT = 0.05;

/**
 * Talia trzech zdjęć z poprzednich edycji, w 3D. Adaptacja mechaniki
 * z pełnoekranowego pierwowzoru (czarne tło, zablokowane przewijanie) do
 * osadzenia na jasnym landingu: sama mechanika (perspektywa, sprężyny,
 * rozsunięcie, plakietka) zostaje, oprawa — nie.
 *
 * Wydajność: żadnych przerenderowań Reacta na klatkę. Wartości sprężyn
 * mieszkają w refach (`fizykaRef`) i są zapisywane wprost do `style` przez
 * pętlę `requestAnimationFrame`. Jedyny stan Reacta to `aktywna` (który
 * indeks jest „pod kursorem"/aktywny) — potrzebny do `aria-pressed`
 * i do tego, która plakietka się renderuje; nic więcej nie potrzebuje
 * przerenderowania.
 *
 * `react-hooks/set-state-in-effect` jest w repo twardym błędem: efekt niżej
 * tylko podpina pętlę rAF i nasłuchy, `setAktywna` wywołuje się wyłącznie
 * z callbacków zdarzeń (pointer/focus/klik), nigdy synchronicznie w ciele
 * efektu.
 */
export function TaliaKart() {
  const [aktywna, setAktywna] = useState<number | null>(null);
  const aktywnaRef = useRef<number | null>(null);
  // Ref zsynchronizowany w efekcie, nie w ciele renderu (`react-hooks/refs`
  // zabrania pisania do refa podczas renderu) — pętla rAF i zewnętrzne
  // nasłuchy czytają `aktywnaRef.current`, żeby nie musiały się resubskrybować
  // przy każdej zmianie `aktywna`.
  useEffect(() => {
    aktywnaRef.current = aktywna;
  }, [aktywna]);

  const kontenerRef = useRef<HTMLDivElement | null>(null);
  const zewnetrzneRefy = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const wewnetrzneRefy = useRef<(HTMLButtonElement | null)[]>([null, null, null]);
  const plakietkaRefy = useRef<(HTMLSpanElement | null)[]>([null, null, null]);
  const fizykaRef = useRef<FizykaKarty[]>(KARTY.map((_, i) => poczatkowaFizyka(i)));
  const przechylRef = useRef<{ x: Kanal; y: Kanal }>({ x: nowyKanal(0), y: nowyKanal(0) });
  const celPrzechylRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zredukowanyRuchRef = useRef(false);
  // Czy bieżący stan „aktywna" powstał z prawdziwego najechania myszą
  // (`onPointerEnter` z `pointerType === "mouse"`), a nie z dotyku/kliku/
  // fokusu klawiaturą. Potrzebne, bo po zakończeniu dotyku przeglądarka
  // potrafi zsyntetyzować „zgodnościowe" zdarzenia myszy na kontenerze —
  // łącznie z `pointerdown` i `pointerleave` opatrzonymi `pointerType:
  // "mouse"` — mimo że nic realnie nie dotknęło myszą. Ufanie samemu
  // `event.pointerType` na `pointerleave` (albo nawet na poprzedzającym go
  // `pointerdown`) więc nie wystarcza: taka zsyntetyzowana para potrafiła
  // otworzyć i natychmiast zamknąć talię w jednym dotyku. Ten ref jest
  // jedynym źródłem prawdy o tym, czy „wyjście" ma cokolwiek zamykać.
  const aktywowanaMyszaRef = useRef(false);
  // Czy urządzenie w ogóle ma sprawną myszkę (nie tylko dotyk). Bez tego
  // sprawdzenia `onPointerEnter` nie wystarczy: przeglądarki potrafią
  // zsyntetyzować „zgodnościowe" zdarzenie `pointerenter` z `pointerType:
  // "mouse"` tuż PRZED prawdziwym dotykiem (zaobserwowane wprost w emulacji
  // dotyku w Chrome/Edge) — samo sprawdzanie `event.pointerType` na
  // pojedynczym zdarzeniu więc nie chroni telefonu przed najechaniem, którego
  // fizycznie nie było. `matchMedia` to jedyne pewne źródło prawdy o tym,
  // czy hover ma sens na tym urządzeniu.
  const hoverCapableRef = useRef(false);

  useEffect(() => {
    const zapytanieHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    hoverCapableRef.current = zapytanieHover.matches;
    const naZmianeHover = () => {
      hoverCapableRef.current = zapytanieHover.matches;
    };
    zapytanieHover.addEventListener("change", naZmianeHover);

    const zapytanie = window.matchMedia("(prefers-reduced-motion: reduce)");
    zredukowanyRuchRef.current = zapytanie.matches;
    const naZmiane = () => {
      zredukowanyRuchRef.current = zapytanie.matches;
    };
    zapytanie.addEventListener("change", naZmiane);

    let klatkaId = 0;
    let ostatniCzas: number | null = null;

    function krok(czas: number) {
      if (ostatniCzas === null) ostatniCzas = czas;
      const dt = Math.min((czas - ostatniCzas) / 1000, MAX_DT);
      ostatniCzas = czas;

      const snap = zredukowanyRuchRef.current;
      const idxAktywna = aktywnaRef.current;
      const otwarta = idxAktywna !== null;

      // Wspólny, bardzo mały przechył za kursorem — jeden kanał na całą talię.
      krokSprezyny(przechylRef.current.x, celPrzechylRef.current.x, ...SPR_GLEBIA_PRZECHYL, dt, snap);
      krokSprezyny(przechylRef.current.y, celPrzechylRef.current.y, ...SPR_GLEBIA_PRZECHYL, dt, snap);
      const przechylX = przechylRef.current.x.v;
      const przechylY = przechylRef.current.y.v;

      for (let i = 0; i < KARTY.length; i++) {
        const f = fizykaRef.current[i];
        const jestAktywna = idxAktywna === i;

        const celSpread = otwarta ? SPREAD[i] : 0;
        const celRotY = otwarta ? -47 : 0;
        const celRotZ = otwarta ? -5 : 0;
        const celLift = !otwarta ? CLOSED_LIFT[i] : jestAktywna ? -26 : -8;
        const celDepth = !otwarta ? CLOSED_DEPTH[i] : jestAktywna ? 38 : OPEN_DEPTH[i];
        const celScale = jestAktywna ? 1.018 : 1;
        const celBright = !otwarta ? CLOSED_BRIGHT[i] : jestAktywna ? 1.08 : 1;

        const sprLiftDepth = jestAktywna ? SPR_AKTYWNA : SPR_GLEBIA_PRZECHYL;

        krokSprezyny(f.spread, celSpread, ...SPR_ROZSUNIECIE, dt, snap);
        krokSprezyny(f.rotY, celRotY, ...SPR_GLEBIA_PRZECHYL, dt, snap);
        krokSprezyny(f.rotZ, celRotZ, ...SPR_GLEBIA_PRZECHYL, dt, snap);
        krokSprezyny(f.lift, celLift, ...sprLiftDepth, dt, snap);
        krokSprezyny(f.depth, celDepth, ...sprLiftDepth, dt, snap);
        krokSprezyny(f.scale, celScale, ...SPR_AKTYWNA, dt, snap);
        krokSprezyny(f.bright, celBright, ...SPR_AKTYWNA, dt, snap);

        const zewn = zewnetrzneRefy.current[i];
        const wewn = wewnetrzneRefy.current[i];
        if (zewn) {
          zewn.style.transform = `translate3d(${f.spread.v}%, ${f.lift.v}px, ${f.depth.v}px)`;
          // Aktywna karta zawsze na wierzchu; poza tym karta 1 (przód, i=0)
          // ponad kolejnymi — w stanie zamkniętym to ona zasłania resztę
          // i to ona musi łapać wskaźnik/dotyk. Odwrotna kolejność (głębsza
          // karta wyżej w z-index) sprawiała, że dotyk/klik trafiał w kartę
          // spod spodu wizualnie, nie w tę faktycznie widoczną na wierzchu.
          zewn.style.zIndex = String(jestAktywna ? 30 : 20 - i);
        }
        if (wewn) {
          wewn.style.transform =
            `rotateX(${przechylY}deg) rotateY(${f.rotY.v + przechylX}deg) ` +
            `rotateZ(${f.rotZ.v}deg) scale(${f.scale.v})`;
          wewn.style.filter = `brightness(${f.bright.v})`;
        }
      }

      klatkaId = requestAnimationFrame(krok);
    }

    klatkaId = requestAnimationFrame(krok);

    return () => {
      cancelAnimationFrame(klatkaId);
      zapytanie.removeEventListener("change", naZmiane);
      zapytanieHover.removeEventListener("change", naZmianeHover);
    };
  }, []);

  // Stuknięcie/klik poza talią zamyka — nasłuch raz, na dokumencie, czytający
  // aktualny stan z refa, żeby efekt nie musiał się przepinać przy każdym
  // otwarciu/zamknięciu.
  useEffect(() => {
    function naWcisniecieDokumentu(event: PointerEvent) {
      if (aktywnaRef.current === null) return;
      const el = kontenerRef.current;
      if (el && event.target instanceof Node && !el.contains(event.target)) {
        setAktywna(null);
      }
    }
    document.addEventListener("pointerdown", naWcisniecieDokumentu);
    return () => document.removeEventListener("pointerdown", naWcisniecieDokumentu);
  }, []);

  function naRuchKontenera(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !hoverCapableRef.current) return;
    const el = kontenerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1; // -1..1
    celPrzechylRef.current = { x: nx * 1.7, y: -ny * 1.1 };
  }

  function naOpuszczenieKontenera() {
    celPrzechylRef.current = { x: 0, y: 0 };
    // Patrz komentarz przy `aktywowanaMyszaRef`: zamykamy na wyjściu tylko,
    // jeśli bieżący stan naprawdę powstał z najechania myszą — inaczej
    // zsyntetyzowane „zgodnościowe" zdarzenie myszy po dotyku zamykałoby
    // talię natychmiast po jej otwarciu.
    if (aktywowanaMyszaRef.current) setAktywna(null);
  }

  function naWejscieKarty(i: number) {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "mouse" || !hoverCapableRef.current) return;
      aktywowanaMyszaRef.current = true;
      setAktywna(i);
    };
  }

  // Przełączenie na `onPointerUp`, nie `onClick`: przeglądarki potrafią
  // opóźniać syntezę zdarzenia `click` po dotyku (klasyczne wykrywanie
  // podwójnego stuknięcia do przybliżenia), więc samo stuknięcie i puszczenie
  // nie zawsze kończyło się widocznym przełączeniem w tej samej klatce
  // interakcji. `pointerup` przychodzi natychmiast i niezawodnie, dla myszy
  // i dotyku jednakowo.
  function przelacz(i: number) {
    aktywowanaMyszaRef.current = false;
    setAktywna((biezaca) => (biezaca === i ? null : i));
  }

  function naPuszczenieKarty(i: number) {
    return () => przelacz(i);
  }

  // `onClick` zostaje wyłącznie jako ścieżka dla aktywacji klawiaturą
  // (Enter/Spacja na przycisku syntetyzują `click`, nie zdarzenia wskaźnika).
  // `event.detail === 0` odróżnia klik zsyntetyzowany przez klawiaturę/AT od
  // kliku myszą/dotykiem (tam `detail` to licznik kliknięć, zawsze ≥ 1) —
  // bez tego warunku mysz i dotyk przełączałyby kartę dwa razy w jednej
  // interakcji (raz z `onPointerUp`, raz z `onClick`).
  function naKlikniecieKarty(i: number) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) przelacz(i);
    };
  }

  function naFokusKarty(i: number) {
    return () => {
      aktywowanaMyszaRef.current = false;
      setAktywna(i);
    };
  }

  function naUtrateFokusu(event: React.FocusEvent<HTMLDivElement>) {
    const el = kontenerRef.current;
    if (el && (!event.relatedTarget || !el.contains(event.relatedTarget as Node))) {
      setAktywna(null);
    }
  }

  function naKlawisz(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") setAktywna(null);
  }

  return (
    <div
      ref={kontenerRef}
      role="group"
      aria-label="Zdjęcia z poprzednich edycji"
      className="talia-obszar relative mx-auto w-[clamp(200px,58vw,300px)]"
      style={{ perspective: "900px", perspectiveOrigin: "50% 40%" }}
      onPointerMove={naRuchKontenera}
      onPointerLeave={naOpuszczenieKontenera}
      onBlur={naUtrateFokusu}
      onKeyDown={naKlawisz}
    >
      <div className="relative aspect-[4/3] w-full">
        {KARTY.map((karta, i) => (
          <div
            key={karta.plik}
            ref={(el) => {
              zewnetrzneRefy.current[i] = el;
            }}
            className="talia-karta-pozycja absolute inset-0 will-change-transform"
          >
            {aktywna === i ? (
              <span
                ref={(el) => {
                  plakietkaRefy.current[i] = el;
                }}
                className="talia-plakietka"
                aria-hidden="true"
              >
                {karta.etykieta}
              </span>
            ) : null}

            <button
              type="button"
              ref={(el) => {
                wewnetrzneRefy.current[i] = el;
              }}
              aria-label={karta.alt}
              aria-pressed={aktywna === i}
              onPointerEnter={naWejscieKarty(i)}
              onPointerUp={naPuszczenieKarty(i)}
              onClick={naKlikniecieKarty(i)}
              onFocus={naFokusKarty(i)}
              className="talia-karta absolute inset-0 overflow-hidden rounded-[0.5rem] border border-white/40
                         bg-jesien-kora shadow-[0_18px_34px_-14px_rgb(47_33_24/0.45)] will-change-transform
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
            >
              <Image
                src={`/hero/${karta.plik}.jpg`}
                alt={karta.alt}
                fill
                draggable={false}
                sizes="(min-width: 600px) 300px, 58vw"
                className="pointer-events-none object-cover"
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
