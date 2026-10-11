"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics (2026-10-11): bez ciasteczek, zliczenia anonimowe.
 * Adres idzie bez parametrów zapytania - w `?blad=` potrafi siedzieć treść
 * komunikatu logowania, a statystykom wystarczy sama ścieżka.
 */
export function Analityka() {
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
