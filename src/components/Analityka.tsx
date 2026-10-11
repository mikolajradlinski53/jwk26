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

  // Landing: które sekcje ktoś faktycznie zobaczył - sekcja dojechała do
  // połowy ekranu (próg powierzchni nie działa: zapisy na telefonie są wyższe
  // niż 2,5 ekranu). Każda raz na wizytę - lejek „doczytał do zapisów?”.
  useEffect(() => {
    if (sciezka !== "/") return;
    const widziane = new Set<string>();
    const naWpisy = (wpisy: IntersectionObserverEntry[]) => {
      for (const w of wpisy) {
        const id = (w.target as HTMLElement).id;
        if (w.isIntersecting && id && !widziane.has(id)) {
          widziane.add(id);
          zdarzenie("sekcja", { sekcja: id });
        }
      }
    };
    // Długie sekcje: górą do połowy ekranu. Krótkie na dole strony (kontakt)
    // tam nie dojadą - dla nich 60% sekcji widoczne naraz.
    const obserwatory = [
      new IntersectionObserver(naWpisy, { rootMargin: "0px 0px -50% 0px", threshold: 0 }),
      new IntersectionObserver(naWpisy, { threshold: 0.6 }),
    ];
    document.querySelectorAll("section[id], #kontakt").forEach((el) => obserwatory.forEach((o) => o.observe(el)));
    return () => obserwatory.forEach((o) => o.disconnect());
  }, [sciezka]);

  // Błędy JavaScriptu: typ i ekran (identyfikatory w adresie zamienione na
  // „:id”), bez treści komunikatu. Każdy rodzaj raz na sesję.
  useEffect(() => {
    const zgloszone = new Set<string>();
    function zglos(typ: string) {
      const ekran = window.location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
      const klucz = `${typ}|${ekran}`;
      if (zgloszone.has(klucz)) return;
      zgloszone.add(klucz);
      zdarzenie("blad_js", { typ, ekran });
    }
    const naBlad = (e: ErrorEvent) => zglos((e.error as Error | undefined)?.name ?? "Error");
    const naOdrzucenie = (e: PromiseRejectionEvent) =>
      zglos(`odrzucenie:${(e.reason as Error | undefined)?.name ?? "inne"}`);
    window.addEventListener("error", naBlad);
    window.addEventListener("unhandledrejection", naOdrzucenie);
    return () => {
      window.removeEventListener("error", naBlad);
      window.removeEventListener("unhandledrejection", naOdrzucenie);
    };
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
