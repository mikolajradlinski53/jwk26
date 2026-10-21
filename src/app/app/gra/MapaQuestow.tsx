"use client";

import { useEffect, useRef } from "react";
import type { Map as MapaLeaflet } from "leaflet";
import "leaflet/dist/leaflet.css";

export type Pinezka = {
  id: string;
  /** Numer na trasie - ten sam, co przy tytule karty. */
  numer: number;
  tytul: string;
  lat: number;
  lng: number;
  zaliczone: boolean;
};

/** Start i meta trasy: OW Zielone Wzgórze (z mapki Mikołaja, 2026-10-21). */
export const BAZA = { lat: 50.7789004, lng: 15.7537969, nazwa: "Start i meta: OW Zielone Wzgórze" };

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRYBUCJA = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function html(p: Pinezka): string {
  // Płaska pinezka w barwach apki; zaliczone gasną na szaro. Treść to numer
  // na trasie - po nim drużyna znajduje kartę zadania niżej.
  const tlo = p.zaliczone ? "#6b5f62" : "var(--color-krew, #c8102e)";
  return (
    `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50% 50% 50% 0;` +
    `transform:rotate(-45deg);background:${tlo};border:2px solid #fff;box-shadow:0 2px 8px rgb(0 0 0/.45)">` +
    `<span style="transform:rotate(45deg);font:700 13px/1 system-ui,sans-serif;color:#fff">${p.numer}</span></span>`
  );
}

// Domek startu i mety: ciemne kółko, żeby nie mylił się z punktem do zaliczenia.
const HTML_BAZY =
  `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#1d1719;` +
  `border:2px solid #fff;box-shadow:0 2px 8px rgb(0 0 0/.45)">` +
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg></span>`;

/**
 * Mapa gry terenowej: pinezki odkrytych zadań z numerami i przerywana trasa
 * od ośrodka przez punkty po kolei z powrotem do ośrodka. Dotknięcie pinezki
 * wybiera zadanie (karta niżej, ze zgłoszeniem i nawigacją). Leaflet ładuje
 * się dopiero w przeglądarce - na serwerze nie ma `window`.
 */
export function MapaQuestow({ pinezki, onWybierz }: { pinezki: Pinezka[]; onWybierz: (id: string) => void }) {
  const kontener = useRef<HTMLDivElement>(null);
  const wybierz = useRef(onWybierz);

  useEffect(() => {
    wybierz.current = onWybierz;
  }, [onWybierz]);

  useEffect(() => {
    let mapa: MapaLeaflet | null = null;
    let porzucone = false;
    void import("leaflet").then((L) => {
      if (porzucone || !kontener.current || pinezki.length === 0) return;
      mapa = L.map(kontener.current, { scrollWheelZoom: false });
      L.tileLayer(OSM, { maxZoom: 19, attribution: ATRYBUCJA }).addTo(mapa);
      const granice = L.latLngBounds([[BAZA.lat, BAZA.lng]]);
      // Trasa pod pinezkami: rysowana pierwsza, więc markery leżą nad nią.
      const trasa: [number, number][] = [
        [BAZA.lat, BAZA.lng],
        ...pinezki.map((p): [number, number] => [p.lat, p.lng]),
        [BAZA.lat, BAZA.lng],
      ];
      L.polyline(trasa, { color: "#c8102e", weight: 3, opacity: 0.75, dashArray: "6 8" }).addTo(mapa);
      L.marker([BAZA.lat, BAZA.lng], {
        icon: L.divIcon({ className: "", html: HTML_BAZY, iconSize: [30, 30], iconAnchor: [15, 15] }),
        title: BAZA.nazwa,
        alt: BAZA.nazwa,
        interactive: false,
      }).addTo(mapa);
      for (const p of pinezki) {
        const ikona = L.divIcon({ className: "", html: html(p), iconSize: [34, 34], iconAnchor: [17, 34] });
        L.marker([p.lat, p.lng], { icon: ikona, title: `${p.numer}. ${p.tytul}`, alt: `${p.numer}. ${p.tytul}`, keyboard: true })
          .addTo(mapa)
          .on("click", () => wybierz.current(p.id));
        granice.extend([p.lat, p.lng]);
      }
      mapa.fitBounds(granice, { padding: [36, 36], maxZoom: 17 });
    });
    return () => {
      porzucone = true;
      mapa?.remove();
    };
  }, [pinezki]);

  return (
    // `isolate`: warstwy Leafleta mają z-index 400+ i bez własnego kontekstu
    // wchodziłyby na dolny pasek nawigacji.
    <div
      ref={kontener}
      role="region"
      aria-label="Mapa zadań gry terenowej"
      className="relative isolate z-0 h-72 w-full overflow-hidden rounded-md border border-white/15 bg-[#e8e4dc]"
    />
  );
}
