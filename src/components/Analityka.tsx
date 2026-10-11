"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { zdarzenie } from "@/lib/zdarzenia";

/**
 * Vercel Web Analytics (2026-10-11): bez ciasteczek, zliczenia anonimowe.
 * Adres idzie bez parametrów zapytania - w `?blad=` potrafi siedzieć treść
 * komunikatu logowania, a statystykom wystarczy sama ścieżka.
 *
 * Kliknięcia: element z `data-zdarzenie` (i opcjonalnie `data-miejsce`)
 * wysyła zdarzenie - tak oznaczone są przyciski zapisu, dokumenty i social
 * na landingu, bez przerabiania komponentów serwerowych na klienckie.
 */
export function Analityka() {
  const sciezka = usePathname();

  useEffect(() => {
    function naKlik(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-zdarzenie]");
      if (!el?.dataset.zdarzenie) return;
      zdarzenie(el.dataset.zdarzenie, el.dataset.miejsce ? { miejsce: el.dataset.miejsce } : undefined);
    }
    document.addEventListener("click", naKlik, { capture: true });
    return () => document.removeEventListener("click", naKlik, { capture: true });
  }, []);

  // Raz na sesję w apce: zainstalowana na ekranie głównym czy w przeglądarce.
  useEffect(() => {
    if (!sciezka.startsWith("/app")) return;
    try {
      if (sessionStorage.getItem("jwk-tryb")) return;
      sessionStorage.setItem("jwk-tryb", "1");
    } catch {
      return;
    }
    const zainstalowana =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    zdarzenie("apka", { tryb: zainstalowana ? "zainstalowana" : "przegladarka" });
  }, [sciezka]);

  return (
    <Analytics
      beforeSend={(e) => {
        const url = new URL(e.url);
        url.search = "";
        url.hash = "";
        return { ...e, url: url.toString() };
      }}
    />
  );
}
