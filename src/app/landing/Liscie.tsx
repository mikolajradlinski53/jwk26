"use client";

import { useEffect, useRef } from "react";

// Wyłącznie kolory jesiennej palety z globals.css: rdza, dynia, mech, kora.
const KOLORY = ["#a8421c", "#d97a2b", "#5f6b3a", "#6b4a2f"];

// Krycie nigdy nie przekracza tej wartości — patrz uzasadnienie przy rysowaniu.
const ALFA_MAX = 0.65;

// Fizyka odpychania/impulsu.
const PROMIEN_ODPYCHANIA = 120; // px — zasięg miękkiego odpychania kursorem
const SILA_ODPYCHANIA = 900; // px/s² w centrum, zanika liniowo do zera na brzegu
const PROMIEN_IMPULSU = 260; // px — zasięg impulsu z kliknięcia/dotknięcia
const SILA_IMPULSU = 320; // px/s dodane w centrum impulsu
/**
 * Tłumienie prędkości dodatkowej, wyrażone **na sekundę**, nie na klatkę.
 *
 * Wartość odpowiada dawnemu mnożnikowi 0,92 przy sześćdziesięciu klatkach
 * (0,92^60 ≈ 0,0069). Przeliczenie było konieczne: mnożnik stały na klatkę
 * wygasza impuls dwa razy szybciej przy stu dwudziestu klatkach niż przy
 * sześćdziesięciu — a sto dwadzieścia ma każdy nowszy iPhone. Odepchnięcie
 * liści byłoby tam wyraźnie słabsze, i to akurat na sprzęcie, na którym ma
 * wyglądać najlepiej.
 */
const TLUMIENIE_NA_SEKUNDE = 0.0069;
const MAX_PREDKOSC_DODATKOWA = 260; // px/s — twardy limit |v| po odpychaniu/impulsie
const MAX_DT = 0.05; // s — przycięcie delty (powrót z tła, spadki FPS)

type Lisc = {
  x: number;
  y: number;
  glebia: number; // 0 = najdalszy plan, 1 = najbliższy
  rozmiar: number;
  predkoscY: number;
  dryf: number;
  czestKolysania: number;
  fazaKolysania: number;
  kat: number;
  predkoscObrotu: number;
  faza3D: number;
  predkosc3D: number;
  alfaMax: number;
  kolor: string;
  // Prędkość dodatkowa doładowywana przez interakcję z kursorem/dotykiem,
  // tłumiona wykładniczo w czasie — bez tego liście po kilku kliknięciach
  // wystrzeliłyby poza ekran i już by nie wróciły.
  vx: number;
  vy: number;
};

// Zakres startowego `y` sięga też poniżej góry ekranu (nie tylko powyżej),
// żeby część liści była widoczna od razu po wejściu na stronę. Same ujemne
// wartości dawały pustą kanwę przez pierwsze kilkadziesiąt sekund — przy
// prędkości opadania rzędu kilkunastu pikseli na sekundę dotarcie z „-wysokość”
// do widocznego ekranu trwało nawet pół minuty.
function losowyLisc(szerokosc: number, wysokosc: number): Lisc {
  // Głębia steruje rozmiarem, prędkością i kryciem naraz — bliższe liście są
  // większe, szybsze i wyraźniejsze, dalsze mniejsze, wolniejsze i bledsze.
  const glebia = Math.random();
  return {
    x: Math.random() * szerokosc,
    y: Math.random() * (wysokosc * 1.4) - wysokosc * 0.4,
    glebia,
    rozmiar: 7 + glebia * 10 + Math.random() * 1.5,
    predkoscY: (14 + glebia * 22) * (0.85 + Math.random() * 0.3),
    dryf: (6 + glebia * 10) * (0.7 + Math.random() * 0.6),
    // Własna faza i częstotliwość kołysania na boki — inaczej wszystkie
    // liście machałyby w tę samą stronę naraz, jak metronomy w rezonansie.
    czestKolysania: 0.4 + Math.random() * 0.9,
    fazaKolysania: Math.random() * Math.PI * 2,
    kat: Math.random() * Math.PI * 2,
    predkoscObrotu: (Math.random() - 0.5) * 1.4 * (0.6 + glebia * 0.8),
    // Cykliczna skala pozioma (patrz rysujLisc) udaje obrót liścia w 3D —
    // raz widać całą płaszczyznę, raz prawie samą krawędź.
    faza3D: Math.random() * Math.PI * 2,
    predkosc3D: 0.6 + Math.random() * 1.8,
    alfaMax: ALFA_MAX * (0.45 + glebia * 0.55),
    kolor: KOLORY[Math.floor(Math.random() * KOLORY.length)],
    vx: 0,
    vy: 0,
  };
}

function rysujLisc(ctx: CanvasRenderingContext2D, lisc: Lisc) {
  const r = lisc.rozmiar;
  // Skala pozioma z cyklu 3D — od "prawie krawędzi" (0.22) do pełnej szerokości.
  const skalaX = 0.22 + 0.78 * Math.abs(Math.cos(lisc.faza3D));

  ctx.save();
  ctx.translate(lisc.x, lisc.y);
  ctx.rotate(lisc.kat);
  ctx.scale(skalaX, 1);

  // Przezroczystość celowa, nie kosmetyczna: liście rysują się pod treścią
  // (z-0 pod kolumną z-10), więc same litery nigdy nie znikają pod liściem —
  // ale „kora” jest jednocześnie kolorem drugorzędnego tekstu na stronie.
  // Liść w pełnym kryciu dokładnie tego samego odcienia, trafiający akurat
  // pod akapit, lokalnie zjadał kontrast tekstu do tła. `alfaMax` liścia
  // nigdy nie przekracza ALFA_MAX (0.65) — dalsze warstwy są jeszcze bledsze.
  ctx.globalAlpha = lisc.alfaMax;
  ctx.fillStyle = lisc.kolor;

  // Sylwetka liścia: zaostrzony czubek, szersza część środkowa, zwężenie
  // do ogonka — cztery krzywe kwadratowe zamiast plamy/elipsy.
  ctx.beginPath();
  ctx.moveTo(0, -r); // czubek
  ctx.quadraticCurveTo(r * 0.75, -r * 0.3, r * 0.55, r * 0.15);
  ctx.quadraticCurveTo(r * 0.35, r * 0.75, 0, r * 0.95); // do nasady
  ctx.quadraticCurveTo(-r * 0.35, r * 0.75, -r * 0.55, r * 0.15);
  ctx.quadraticCurveTo(-r * 0.75, -r * 0.3, 0, -r); // z powrotem do czubka
  ctx.closePath();
  ctx.fill();

  // Cieniutkie żyłkowanie wzdłuż osi głównej.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
  ctx.lineWidth = Math.max(0.5, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(0, r * 0.85);
  ctx.stroke();

  // Ogonek.
  ctx.strokeStyle = lisc.kolor;
  ctx.lineWidth = Math.max(0.6, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.lineTo(0, r * 1.15);
  ctx.stroke();

  ctx.restore();
}

/**
 * Spadające liście — dekoracja rysowana na kanwie, w warstwie `fixed inset-0`
 * pod treścią i nad tłem landingu. Sylwetki krzywych Béziera z kołysaniem,
 * obrotem i pseudo-3D (skala pozioma), reagujące na kursor/dotyk — ale wciąż
 * spokojne, nie śnieżyca.
 *
 * Zabezpieczenia, bez których to usterka, nie dekoracja:
 * - `prefers-reduced-motion: reduce` — pętla w ogóle się nie uruchamia, a
 *   nasłuchy pointera w ogóle się nie podpinają (nie ma czego odpychać).
 *   Globalna reguła w `globals.css` wyłącza animacje CSS, ale kanwy nie
 *   dotyczy — sprawdzamy to sami przez `matchMedia`.
 * - `visibilitychange` — pętla zatrzymuje się, gdy karta jest niewidoczna,
 *   a przy wznowieniu `ostatniCzas` jest resetowany, żeby nie policzyć
 *   jednej gigantycznej klatki z czasu spędzonego w tle.
 * - `navigator.hardwareConcurrency <= 4` — liczba liści spada z 40 do 15
 *   na słabszym sprzęcie.
 * - Delta klatki przycięta do MAX_DT — również chroni przed tym samym
 *   skokiem po powrocie z tła i przed szarpaniem na wysokich odświeżaniach.
 *
 * Interakcja: kanwa ma `pointer-events-none` (leży nad całą stroną, w tym
 * nad przyciskiem wejścia) i nasłuchy są celowo podpięte na `window`, nie na
 * kanwie — zdarzenia `pointermove`/`pointerdown` docierają tam niezależnie
 * od tego, w co faktycznie trafił kursor/palec. Pozycja kursora trzymana w
 * refie i czytana w pętli; kliknięcie i dotknięcie idą tą samą ścieżką
 * (Pointer Events ujednolicają mysz i dotyk), więc telefon dostaje ten sam
 * impuls co desktop.
 *
 * Stan wyłącznie w refach: kanwa nie potrzebuje przerenderowań Reacta,
 * a `react-hooks/set-state-in-effect` jest w tym repozytorium twardym błędem.
 */
export function Liscie() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const iloscLisci = (navigator.hardwareConcurrency ?? 8) <= 4 ? 15 : 40;

    let szerokosc = window.innerWidth;
    let wysokosc = window.innerHeight;

    function ustawRozmiar() {
      szerokosc = window.innerWidth;
      wysokosc = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.round(szerokosc * dpr);
      canvas!.height = Math.round(wysokosc * dpr);
      canvas!.style.width = `${szerokosc}px`;
      canvas!.style.height = `${wysokosc}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ustawRozmiar();
    const lisce: Lisc[] = Array.from({ length: iloscLisci }, () =>
      losowyLisc(szerokosc, wysokosc),
    );

    // Pozycja kursora/dotyku, daleko poza ekranem dopóki nie przyjdzie
    // pierwsze realne zdarzenie — żeby nic nie było odpychane od (0, 0).
    const wskaznik = { x: -10000, y: -10000 };

    // Wspólny, powoli zmieniający się wiatr — raz wieje w lewo, raz w prawo.
    let czasWiatru = 0;

    let klatkaId = 0;
    let ostatniCzas: number | null = null;

    function krok(czas: number) {
      if (ostatniCzas === null) ostatniCzas = czas;
      const dt = Math.min((czas - ostatniCzas) / 1000, MAX_DT);
      ostatniCzas = czas;

      czasWiatru += dt;
      const wiatr = Math.sin(czasWiatru * 0.15) * 10;

      ctx!.clearRect(0, 0, szerokosc, wysokosc);

      for (const lisc of lisce) {
        // Miękkie odpychanie kursorem/palcem w promieniu PROMIEN_ODPYCHANIA —
        // im bliżej, tym silniej, liniowy zanik do zera na brzegu.
        const dx = lisc.x - wskaznik.x;
        const dy = lisc.y - wskaznik.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < PROMIEN_ODPYCHANIA * PROMIEN_ODPYCHANIA) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const sila = (1 - dist / PROMIEN_ODPYCHANIA) * SILA_ODPYCHANIA;
          lisc.vx += (dx / dist) * sila * dt;
          lisc.vy += (dy / dist) * sila * dt;
        }

        // Tłumienie — bez niego prędkość dodatkowa z odpychania/impulsów
        // rosłaby bez końca.
        const tlumienie = Math.pow(TLUMIENIE_NA_SEKUNDE, dt);
        lisc.vx *= tlumienie;
        lisc.vy *= tlumienie;

        // Limit prędkości dodatkowej, żeby impuls nie wyrzucił liścia poza
        // ekran w jednej klatce.
        const predkoscDod = Math.hypot(lisc.vx, lisc.vy);
        if (predkoscDod > MAX_PREDKOSC_DODATKOWA) {
          const skala = MAX_PREDKOSC_DODATKOWA / predkoscDod;
          lisc.vx *= skala;
          lisc.vy *= skala;
        }

        lisc.fazaKolysania += dt * lisc.czestKolysania;
        lisc.faza3D += dt * lisc.predkosc3D;
        lisc.kat += lisc.predkoscObrotu * dt;

        lisc.y += (lisc.predkoscY + lisc.vy) * dt;
        lisc.x +=
          (Math.sin(lisc.fazaKolysania) * lisc.dryf + wiatr + lisc.vx) * dt;

        // Zawijanie w poziomie — impuls/wiatr nie zgubi liścia na stałe poza
        // ekranem, a widz nie zobaczy "teleportacji" na pustym marginesie.
        if (lisc.x < -60) lisc.x = szerokosc + 60;
        else if (lisc.x > szerokosc + 60) lisc.x = -60;

        if (lisc.y - lisc.rozmiar > wysokosc) {
          lisc.y = -lisc.rozmiar;
          lisc.x = Math.random() * szerokosc;
        }

        rysujLisc(ctx!, lisc);
      }

      klatkaId = requestAnimationFrame(krok);
    }

    klatkaId = requestAnimationFrame(krok);

    function naZmianeWidocznosci() {
      if (document.hidden) {
        cancelAnimationFrame(klatkaId);
      } else {
        ostatniCzas = null;
        klatkaId = requestAnimationFrame(krok);
      }
    }

    function naZmianeRozmiaru() {
      ustawRozmiar();
    }

    function naRuchWskaznika(event: PointerEvent) {
      wskaznik.x = event.clientX;
      wskaznik.y = event.clientY;
    }

    // Kliknięcie myszą i stuknięcie na ekranie dotykowym trafiają tu tą samą
    // ścieżką (Pointer Events) — impuls rozchodzący się od punktu zdarzenia,
    // z zanikiem liniowym do zera na brzegu promienia.
    function naWcisniecieWskaznika(event: PointerEvent) {
      const kx = event.clientX;
      const ky = event.clientY;
      for (const lisc of lisce) {
        const dx = lisc.x - kx;
        const dy = lisc.y - ky;
        const distSq = dx * dx + dy * dy;
        if (distSq >= PROMIEN_IMPULSU * PROMIEN_IMPULSU) continue;
        const dist = Math.sqrt(distSq) || 0.0001;
        const sila = (1 - dist / PROMIEN_IMPULSU) * SILA_IMPULSU;
        lisc.vx += (dx / dist) * sila;
        lisc.vy += (dy / dist) * sila;
      }
    }

    // Mysz opuszczająca okno przeglądarki — cofnij wskaźnik daleko poza
    // ekran, żeby nie odpychał liści od nieaktualnej, "zawieszonej" pozycji.
    function naUtratePozycji() {
      wskaznik.x = -10000;
      wskaznik.y = -10000;
    }

    document.addEventListener("visibilitychange", naZmianeWidocznosci);
    window.addEventListener("resize", naZmianeRozmiaru);
    window.addEventListener("pointermove", naRuchWskaznika, { passive: true });
    window.addEventListener("pointerdown", naWcisniecieWskaznika, {
      passive: true,
    });
    window.addEventListener("blur", naUtratePozycji);

    return () => {
      cancelAnimationFrame(klatkaId);
      document.removeEventListener("visibilitychange", naZmianeWidocznosci);
      window.removeEventListener("resize", naZmianeRozmiaru);
      window.removeEventListener("pointermove", naRuchWskaznika);
      window.removeEventListener("pointerdown", naWcisniecieWskaznika);
      window.removeEventListener("blur", naUtratePozycji);
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
  );
}
