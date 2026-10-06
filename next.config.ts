import type { NextConfig } from "next";

// Pliki z `public/` Vercel domyślnie wysyła z `max-age=0`: telefon przy każdym
// wejściu pyta o każdą klatkę żaby, logo i zdjęcie od nowa, a każde takie
// pytanie (nawet z odpowiedzią „bez zmian") liczy się do limitu żądań CDN
// w planie Hobby. 30 dni w przeglądarce. Skutek uboczny: podmiana pliku pod
// tą samą nazwą dotrze do ludzi dopiero po 30 dniach - nowa grafika = nowa nazwa.
const MIESIAC = "public, max-age=2592000, stale-while-revalidate=86400";

const nextConfig: NextConfig = {
  images: {
    // Zdjęcia przez /_next/image: ta sama zasada co wyżej (domyślnie 4 h).
    minimumCacheTTL: 2678400,
  },
  async headers() {
    return [
      ...["/grafika/:path*", "/hero/:path*", "/logo/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: MIESIAC }],
      })),
      {
        // Service worker bez cache: inaczej telefon trzymałby starą wersję
        // obsługi powiadomień nawet po wdrożeniu poprawki.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
