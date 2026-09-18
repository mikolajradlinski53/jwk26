"use client";

import { useEffect, useRef } from "react";

// Wyłącznie kolory jesiennej palety z globals.css: rdza, dynia, mech, kora.
const KOLORY = ["#a8421c", "#d97a2b", "#5f6b3a", "#6b4a2f"];

type Lisc = {
  x: number;
  y: number;
  rozmiar: number;
  predkoscY: number;
  dryf: number;
  fazaDryfu: number;
  kat: number;
  predkoscObrotu: number;
  kolor: string;
};

// Zakres startowego `y` sięga też poniżej góry ekranu (nie tylko powyżej),
// żeby część liści była widoczna od razu po wejściu na stronę. Same ujemne
// wartości dawały pustą kanwę przez pierwsze kilkadziesiąt sekund — przy
// prędkości opadania rzędu kilkunastu pikseli na sekundę dotarcie z „-wysokość”
// do widocznego ekranu trwało nawet pół minuty.
function losowyLisc(szerokosc: number, wysokosc: number): Lisc {
  return {
    x: Math.random() * szerokosc,
    y: Math.random() * (wysokosc * 1.4) - wysokosc * 0.4,
    rozmiar: 8 + Math.random() * 9,
    predkoscY: 16 + Math.random() * 18,
    dryf: 8 + Math.random() * 14,
    fazaDryfu: Math.random() * Math.PI * 2,
    kat: Math.random() * Math.PI * 2,
    predkoscObrotu: (Math.random() - 0.5) * 1.1,
    kolor: KOLORY[Math.floor(Math.random() * KOLORY.length)],
  };
}

function rysujLisc(ctx: CanvasRenderingContext2D, lisc: Lisc) {
  const r = lisc.rozmiar;
  ctx.save();
  ctx.translate(lisc.x, lisc.y);
  ctx.rotate(lisc.kat);
  ctx.fillStyle = lisc.kolor;
  // Przezroczystość celowa, nie kosmetyczna: liście rysują się pod treścią
  // (z-0 pod kolumną z-10), więc same litery nigdy nie znikają pod liściem —
  // ale `kora` jest jednocześnie kolorem drugorzędnego tekstu na stronie.
  // Liść w pełnym kryciu dokładnie tego samego odcienia, trafiający akurat
  // pod akapit, lokalnie zjadał kontrast tekstu do tła. Przy tej przezroczystości
  // nawet zbieżność kolorów daje jaśniejszą plamę, nie kamuflaż.
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.8, -r * 0.55, r * 0.8, r * 0.55, 0, r);
  ctx.bezierCurveTo(-r * 0.8, r * 0.55, -r * 0.8, -r * 0.55, 0, -r);
  ctx.fill();
  ctx.restore();
}

/**
 * Spadające liście — dekoracja rysowana na kanwie, w warstwie `fixed inset-0`
 * pod treścią i nad tłem landingu. Sylwetki, nie obrazek: proste kształty
 * z lekkim obrotem i dryfem w bok, spokojne — nie śnieżyca.
 *
 * Trzy zabezpieczenia, bez których to usterka, nie dekoracja:
 * - `prefers-reduced-motion: reduce` — pętla w ogóle się nie uruchamia.
 *   Globalna reguła w `globals.css` wyłącza animacje CSS, ale kanwy nie
 *   dotyczy — sprawdzamy to sami przez `matchMedia`.
 * - `visibilitychange` — pętla zatrzymuje się, gdy karta jest niewidoczna.
 * - `navigator.hardwareConcurrency <= 4` — liczba liści spada z 40 do 15
 *   na słabszym sprzęcie.
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

    let klatkaId = 0;
    let ostatniCzas: number | null = null;

    function krok(czas: number) {
      if (ostatniCzas === null) ostatniCzas = czas;
      const dt = Math.min((czas - ostatniCzas) / 1000, 0.1);
      ostatniCzas = czas;

      ctx!.clearRect(0, 0, szerokosc, wysokosc);

      for (const lisc of lisce) {
        lisc.y += lisc.predkoscY * dt;
        lisc.fazaDryfu += dt * 0.6;
        lisc.x += Math.sin(lisc.fazaDryfu) * lisc.dryf * dt;
        lisc.kat += lisc.predkoscObrotu * dt;

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

    document.addEventListener("visibilitychange", naZmianeWidocznosci);
    window.addEventListener("resize", naZmianeRozmiaru);

    return () => {
      cancelAnimationFrame(klatkaId);
      document.removeEventListener("visibilitychange", naZmianeWidocznosci);
      window.removeEventListener("resize", naZmianeRozmiaru);
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
  );
}
