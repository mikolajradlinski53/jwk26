"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";

/**
 * Ciemny panel wezwania — jedyny czarny element na landingu. To zapowiedź
 * apki: landing jest ciepły, ale tuż nad przyciskiem wejścia pojawia się
 * przebłysk drugiego świata (paleta `noc` / `krew-glab`, patrz globals.css).
 *
 * Poświata podąża za kursorem przez zmienne CSS `--mysz-x` / `--mysz-y`
 * ustawiane wprost na elemencie (`style.setProperty`), nie przez stan Reacta —
 * `react-hooks/set-state-in-effect` jest tu twardym błędem, a stan i tak nie
 * jest do niczego potrzebny: nikt inny nie czyta pozycji kursora.
 *
 * Tła (oddech, dryf plam, wjazd treści) to czyste animacje CSS w globals.css —
 * globalna reguła `prefers-reduced-motion` w globals.css zeruje ich czas
 * automatycznie. Tego samego zerowania NIE dostaje obsługa kursora (to logika
 * JS, nie CSS), więc `naRuchWskaznika` sprawdza `matchMedia` sam.
 */
export function PanelWezwania() {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const naRuchWskaznika = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = panelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mysz-x", `${x}%`);
    el.style.setProperty("--mysz-y", `${y}%`);
  }, []);

  const naOpuszczenie = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.setProperty("--mysz-x", "50%");
    el.style.setProperty("--mysz-y", "0%");
  }, []);

  return (
    <div
      ref={panelRef}
      onPointerMove={naRuchWskaznika}
      onPointerLeave={naOpuszczenie}
      className="stopka-panel relative isolate flex min-h-[350px] w-full flex-col items-center
                 overflow-hidden rounded-b-[29px] px-4 pb-10
                 shadow-[0_28px_60px_-20px_rgb(0_0_0/0.55)]
                 min-[600px]:min-h-[314px] min-[600px]:rounded-b-[35px]"
    >
      <div className="stopka-oddech" aria-hidden="true" />
      <div className="stopka-blob stopka-blob-lewy" aria-hidden="true" />
      <div className="stopka-blob stopka-blob-prawy" aria-hidden="true" />
      <div className="stopka-cursor-glow" aria-hidden="true" />
      <div className="stopka-ziarno" aria-hidden="true" />

      <div
        className="stopka-wjazd relative z-10 mt-[59px] flex max-w-[680px] flex-col items-center
                   text-center min-[600px]:mt-[42px]"
      >
        {/* Panel jest ciemny — jedyne miejsce, gdzie logo występuje w wariancie białym. */}
        <Image
          src="/logo/logo-biale.png"
          alt="Jesienny Wyjazd Komisji"
          width={1600}
          height={597}
          className="h-6 w-auto opacity-90 min-[600px]:h-7"
        />

        <h2
          className="mt-4 max-w-[340px] font-tytul text-[clamp(26px,2.9vw,34px)] leading-[1.1]
                     tracking-tight text-white [text-wrap:balance] min-[600px]:max-w-none"
        >
          Zostało mniej, niż myślisz
        </h2>

        {/*
          Kontrast: białe 47% na czerni z briefu daje ~4,8:1 na najciemniejszym
          fragmencie panelu — zbyt blisko progu 4,5:1, biorąc pod uwagę, że tło
          w tym miejscu bywa lokalnie jaśniejsze (plamy, poświata kursora).
          Podniesione do 80%: ok. 12:1 na `noc`, z bezpiecznym zapasem.
        */}
        <p
          className="mt-3 max-w-[330px] text-[13px] leading-relaxed text-white/80
                     min-[600px]:max-w-[520px] min-[600px]:text-[14px]"
        >
          Zgłoszenia zamykamy, gdy skończą się miejsca. Wejdź, wypełnij formularz i miej to z głowy.
        </p>

        <Link
          href="/wejscie"
          className="stopka-cta group relative mt-[31px] flex h-[42px] min-w-[120px] items-center
                     justify-center overflow-hidden rounded-sm bg-white px-6 text-[12px]
                     font-semibold text-noc
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                     min-[600px]:mt-6"
        >
          <span className="relative z-10">Wejdź do Sekty</span>
          <span className="stopka-cta-blask" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
