"use client";

import { useEffect, useRef } from "react";
import type { Animacja } from "./klatki";
import { stylKlatki } from "./sprite";

/**
 * Żaba wpisana w sekcję landingu (spec landingu, sekcja 3; decyzja Mikołaja
 * 2026-09-29: w każdej sekcji inna poza zamiast wędrówki po dzielnikach).
 *
 * Zewnętrzny element przyjmuje pozycjonowanie z `className`, wewnętrzny
 * rysuje klatkę i animuje się - rozdzielone, bo transformacje położenia
 * i animacji nadpisywałyby się nawzajem.
 *
 * Ruch: gdy żaba wjeżdża w ekran - wskok (`.zaba-wchodzi`), potem lekkie
 * kołysanie (`.zaba-kolys`); dotknięcie - podskok (`.zaba-hop`). Ukrycie
 * przed wskokiem nakłada dopiero skrypt i tylko dla żab jeszcze pod ekranem,
 * więc bez JavaScriptu i przy ograniczonym ruchu żaba po prostu stoi.
 * W hero `siedzi` macha dwiema klatkami (`.zaba-machanie`).
 *
 * Dekoracja: `aria-hidden`.
 */
export function ZabaStala({
  poza,
  skala = 1,
  className = "",
  polozenie,
}: {
  poza: Animacja;
  skala?: number;
  className?: string;
  /** Położenie względem rodzica (np. karty licznika) - styl wprost, bez klas z `calc`. */
  polozenie?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const r = el.getBoundingClientRect();
    const obserwator = new IntersectionObserver(
      ([wpis]) => {
        if (!wpis.isIntersecting) return;
        el.classList.remove("zaba-czeka");
        el.classList.add("zaba-wchodzi");
        obserwator.disconnect();
      },
      { threshold: 0.4 },
    );
    // Tylko żaby poniżej ekranu czekają na wskok; te widoczne od razu stoją.
    if (r.top > window.innerHeight) {
      el.classList.add("zaba-czeka");
      obserwator.observe(el);
    }

    function hop() {
      el?.classList.remove("zaba-hop");
      // Wymuszenie przeliczenia, żeby ta sama animacja ruszyła od nowa.
      void el?.offsetWidth;
      el?.classList.add("zaba-hop");
    }
    function koniec(e: AnimationEvent) {
      if (e.animationName === "zaba-hop") el?.classList.remove("zaba-hop");
    }
    el.addEventListener("pointerdown", hop);
    el.addEventListener("animationend", koniec);
    return () => {
      obserwator.disconnect();
      el.removeEventListener("pointerdown", hop);
      el.removeEventListener("animationend", koniec);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${polozenie ? "absolute" : ""} ${className}`}
      style={polozenie}
    >
      <div
        ref={ref}
        className={`zaba-kolys pointer-events-auto origin-bottom ${poza === "siedzi" ? "zaba-machanie" : ""}`}
        style={stylKlatki(poza, 0, skala)}
      />
    </div>
  );
}
