"use client";

import { useEffect, useRef } from "react";
import type { Map as MapaLeaflet } from "leaflet";
import "leaflet/dist/leaflet.css";

export type Pinezka = {
  id: string;
  tytul: string;
  punkty: number;
  lat: number;
  lng: number;
  zaliczone: boolean;
};

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRYBUCJA = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function html(p: Pinezka): string {
  // Płaska pinezka w barwach apki; zaliczone gasną na szaro. Treść to liczba
  // punktów - jedyne, co warto widzieć na mapie, zanim się w nią dotknie.
  const tlo = p.zaliczone ? "#6b5f62" : "var(--color-krew, #c8102e)";
  return (
    `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:50% 50% 50% 0;` +
    `transform:rotate(-45deg);background:${tlo};border:2px solid #fff;box-shadow:0 2px 8px rgb(0 0 0/.45)">` +
    `<span style="transform:rotate(45deg);font:700 11px/1 system-ui,sans-serif;color:#fff">${p.punkty}</span></span>`
  );
}

/**
 * Mapa gry terenowej: pinezki odkrytych zadań z miejscem. Dotknięcie pinezki
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
      const granice = L.latLngBounds([]);
      for (const p of pinezki) {
        const ikona = L.divIcon({ className: "", html: html(p), iconSize: [34, 34], iconAnchor: [17, 34] });
        L.marker([p.lat, p.lng], { icon: ikona, title: p.tytul, alt: p.tytul, keyboard: true })
          .addTo(mapa)
          .on("click", () => wybierz.current(p.id));
        granice.extend([p.lat, p.lng]);
      }
      if (pinezki.length === 1) mapa.setView([pinezki[0].lat, pinezki[0].lng], 16);
      else mapa.fitBounds(granice, { padding: [36, 36], maxZoom: 17 });
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
