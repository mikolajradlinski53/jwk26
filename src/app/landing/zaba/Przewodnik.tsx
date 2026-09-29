"use client";

import { useEffect, useRef } from "react";
import { KLATKI, type Animacja } from "./klatki";
import { adresPaska, stylKlatki } from "./sprite";
import {
  aktywnaTrasa,
  czyWskazuje,
  kierunek,
  klatkaChodu,
  polozenieX,
  postepTrasy,
  ulamekDrogi,
} from "./ruch";

const WYGLUPY: { a: Animacja; powtorzenia: number }[] = [
  { a: "podskok", powtorzenia: 1 },
  { a: "taniec", powtorzenia: 2 },
  { a: "potkniecie", powtorzenia: 1 },
  { a: "macha", powtorzenia: 2 },
];
const MS_KLATKA_WYGLUPU = 160;
const MS_KLATKA_WSKAZYWANIA = 450;
const MS_BEZRUCHU = 4000;
/** Droga (px) na jedną klatkę chodu przy skali 1. */
const KROK = 13;

/**
 * Żaba-przewodnik (spec landingu, sekcja 3). Chodzi po dzielnikach
 * oznaczonych `data-trasa-zaby` w rytm przewijania: postęp dzielnika przez
 * okno to jej droga od lewej do prawej krawędzi, a klatka chodu wynika
 * z przebytej drogi, więc przy zatrzymaniu przewijania żaba stoi. Przed
 * zasłoniętą sekcją (`data-trasa-zaby="wskazuj"`) w połowie drogi staje
 * i wskazuje. Po 4 s bez przewijania albo po dotknięciu — wygłup.
 *
 * Położenie i klatka idą prosto do stylu elementu (bez stanu Reacta): to
 * zmienia się w każdej klatce przewijania, a render Reacta w tym tempie
 * tylko by przeszkadzał. `prefers-reduced-motion`: żaba stoi bez ruchu przy
 * bieżącym dzielniku, bez chodu i bez samoczynnych wygłupów.
 *
 * Żaba nic nie mówi i jest `aria-hidden` — to dekoracja.
 */
export function Przewodnik() {
  const warstwa = useRef<HTMLDivElement | null>(null);
  const zaba = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = zaba.current;
    if (!el) return;

    const spokoj = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let skala = window.innerWidth < 600 ? 0.8 : 1;

    let gotowa = false;
    let ramka = 0;
    let ostatnieX: number | null = null;
    let droga = 0;
    let zwrot: 1 | -1 = 1;
    let wyglup: { a: Animacja; start: number; dlugosc: number } | null = null;
    let wskazuje = false;
    let zegarBezruchu = 0;
    let petla = 0;

    function rysuj(a: Animacja, i: number, x: number, podloze: number) {
      if (!el) return;
      const s = stylKlatki(a, i, skala);
      el.style.width = s.width;
      el.style.height = s.height;
      el.style.backgroundImage = s.backgroundImage;
      el.style.backgroundSize = s.backgroundSize;
      el.style.backgroundPosition = s.backgroundPosition;
      const wys = KLATKI[a].wysokosc * skala;
      el.style.transform = `translate3d(${x}px, ${podloze - wys}px, 0) scaleX(${zwrot})`;
      el.style.visibility = "visible";
    }

    function ukryj() {
      if (el) el.style.visibility = "hidden";
      ostatnieX = null;
    }

    // Stan trasy w tej chwili — zawsze z żywego pomiaru, bo przewijanie,
    // zmiana rozmiaru i odsłona sekcji przesuwają dzielniki.
    function pomiar() {
      const trasy = [...document.querySelectorAll<HTMLElement>("[data-trasa-zaby]")];
      const rect = trasy.map((t) => t.getBoundingClientRect());
      const wysOkna = window.innerHeight;
      const i = aktywnaTrasa(rect.map((r) => ({ gora: r.top, dol: r.bottom })), wysOkna);
      if (i < 0) return null;
      const t = trasy[i];
      const r = rect[i];
      const naWskazanie = t.dataset.trasaZaby === "wskazuj";
      const p = postepTrasy(r.top, wysOkna);
      const podloze = r.top + r.height * Number(t.dataset.podloze ?? "0.6");
      return { p, naWskazanie, podloze };
    }

    function klatka(teraz: number) {
      ramka = 0;
      if (!gotowa) return;
      const m = pomiar();
      if (!m) {
        ukryj();
        wyglup = null;
        return;
      }
      const szer = KLATKI.chod.szerokosc * skala;

      if (spokoj) {
        zwrot = 1;
        rysuj("macha", 0, window.innerWidth * 0.08, m.podloze);
        return;
      }

      const x = polozenieX(ulamekDrogi(m.p, m.naWskazanie), window.innerWidth, szer);
      const dx = ostatnieX === null ? 0 : x - ostatnieX;
      ostatnieX = x;

      if (Math.abs(dx) > 0.5) {
        // Ruch przerywa wygłup — żaba nie tańczy, kiedy dzielnik ucieka.
        wyglup = null;
        zwrot = kierunek(dx, zwrot);
        droga += Math.abs(dx);
      }

      wskazuje = czyWskazuje(m.p, m.naWskazanie);

      if (wyglup) {
        const n = KLATKI[wyglup.a].klatki;
        const k = Math.floor((teraz - wyglup.start) / MS_KLATKA_WYGLUPU);
        if (k >= wyglup.dlugosc) {
          wyglup = null;
          planujBezruch(6000);
        } else {
          // Wygłup jest szerszy niż chód — wyśrodkuj go na miejscu żaby.
          const przesuniecie = (KLATKI[wyglup.a].szerokosc * skala - szer) / 2;
          rysuj(wyglup.a, k % n, x - przesuniecie, m.podloze);
          zaplanujPetle();
          return;
        }
      }

      if (wskazuje) {
        zwrot = 1;
        const k = Math.floor(teraz / MS_KLATKA_WSKAZYWANIA) % KLATKI.wskazuje.klatki;
        rysuj("wskazuje", k, x, m.podloze);
        zaplanujPetle();
        return;
      }

      rysuj("chod", klatkaChodu(droga, KROK * skala, KLATKI.chod.klatki), x, m.podloze);
    }

    function zaplanujPetle() {
      if (!petla) {
        petla = window.setTimeout(() => {
          petla = 0;
          zaplanuj();
        }, 60);
      }
    }

    function zaplanuj() {
      if (!ramka) ramka = requestAnimationFrame(klatka);
    }

    function wyglupnij() {
      if (spokoj || !gotowa || !el || el.style.visibility !== "visible" || wskazuje) return;
      // Tylko cała na ekranie — wygłup w połowie za krawędzią nikogo nie bawi.
      const szer = KLATKI.chod.szerokosc * skala;
      if (ostatnieX === null || ostatnieX < 0 || ostatnieX > window.innerWidth - szer) return;
      const w = WYGLUPY[Math.floor(Math.random() * WYGLUPY.length)];
      wyglup = { a: w.a, start: performance.now(), dlugosc: KLATKI[w.a].klatki * w.powtorzenia };
      zaplanuj();
    }

    function planujBezruch(ms = MS_BEZRUCHU) {
      window.clearTimeout(zegarBezruchu);
      zegarBezruchu = window.setTimeout(wyglupnij, ms);
    }

    function naPrzewiniecie() {
      planujBezruch();
      zaplanuj();
    }

    function naRozmiar() {
      skala = window.innerWidth < 600 ? 0.8 : 1;
      ostatnieX = null;
      zaplanuj();
    }

    function naWidocznosc() {
      if (document.hidden) {
        window.clearTimeout(zegarBezruchu);
        window.clearTimeout(petla);
        petla = 0;
      } else {
        planujBezruch();
        zaplanuj();
      }
    }

    function naDotyk() {
      wyglupnij();
    }

    // Paski ładujemy po wczytaniu strony — żaba to dekoracja, nie może
    // konkurować z pierwszą klatką landingu o łącze.
    const doZaladowania: Animacja[] = spokoj ? ["macha"] : (Object.keys(KLATKI) as Animacja[]);
    let anulowane = false;
    const start = () => {
      Promise.all(
        doZaladowania.map((a) => {
          const im = new Image();
          im.src = adresPaska(a);
          return im.decode();
        }),
      )
        .then(() => {
          if (anulowane) return;
          gotowa = true;
          planujBezruch();
          zaplanuj();
        })
        .catch(() => {
          // Bez grafiki żaby nie ma — strona działa dalej.
        });
    };
    // Safari na iOS nie ma requestIdleCallback — tam zwykłe opóźnienie.
    const maIdle = typeof window.requestIdleCallback === "function";
    const bezczynnosc = maIdle
      ? window.requestIdleCallback(start, { timeout: 2500 })
      : window.setTimeout(start, 800);

    window.addEventListener("scroll", naPrzewiniecie, { passive: true });
    window.addEventListener("resize", naRozmiar);
    document.addEventListener("visibilitychange", naWidocznosc);
    el.addEventListener("pointerdown", naDotyk);

    return () => {
      anulowane = true;
      if (maIdle) window.cancelIdleCallback(bezczynnosc);
      else window.clearTimeout(bezczynnosc);
      window.clearTimeout(zegarBezruchu);
      window.clearTimeout(petla);
      cancelAnimationFrame(ramka);
      window.removeEventListener("scroll", naPrzewiniecie);
      window.removeEventListener("resize", naRozmiar);
      document.removeEventListener("visibilitychange", naWidocznosc);
      el.removeEventListener("pointerdown", naDotyk);
    };
  }, []);

  return (
    <div ref={warstwa} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[15] overflow-hidden">
      <div
        ref={zaba}
        className="pointer-events-auto invisible absolute left-0 top-0 origin-bottom cursor-pointer
                   bg-no-repeat will-change-transform [image-rendering:auto] select-none"
      />
    </div>
  );
}
