import type { Metadata } from "next";

/**
 * Metadane apki - nazwa z motywem, manifest i tytuł na ekranie głównym.
 * Tylko dla `/app` i `/wejscie` (tam odbywa się instalacja). Wcześniej
 * siedziały w głównym layoutcie i wyciekały do stron publicznych
 * (regulamin, polityka) jako `apple-mobile-web-app-title` i link do
 * manifestu - wyłapała to kontrola przecieku z planu 16a.
 */
export const METADANE_APKI: Metadata = {
  title: "Sekta Wyjazdowa",
  description: "Rytuał trwa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sekta",
  },
};
