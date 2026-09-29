import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { preload } from "react-dom";
import "./globals.css";

// Oś `opsz` celowo pominięta: poprawia rysunek w dużych rozmiarach, ale dokłada
// wariantów do pobrania. Jeśli tytuły będą wyglądać ciężko, dopisz axes: ["opsz"].
const bodoni = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  variable: "--font-bodoni",
});

// Manrope nie ma kursywy — <em> dostanie syntetyczny pochył. Do wyróżnień
// używamy wagi, nie kursywy.
const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Sekta Wyjazdowa",
  description: "Rytuał trwa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sekta",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0709",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tło widać na każdym ekranie — niech przeglądarka zacznie je ciągnąć
  // razem z HTML-em, a nie dopiero po sparsowaniu stylów.
  preload("/grafika/tlo-apki.webp", { as: "image", type: "image/webp" });

  return (
    <html lang="pl" className={`${bodoni.variable} ${manrope.variable}`}>
      <body>
        {/*
          Tło apki mieszka w warstwie globalnej, nie na ekranach. To ono jest
          tym, co rozmywa szkło — bez niego backdrop-filter nie ma czego
          rozmywać i szkło zamienia się w szarą płytę. Jedno tło znaczy też,
          że każdy nowy ekran jest szklany od razu.

          Obraz z Higgsfielda (Dym, spec wyglądu §4), 9 KB. `fixed` na
          elemencie, nie `background-attachment: fixed` — iOS tamto ignoruje.
          Kolor pod spodem to --color-noc: zanim obraz dojdzie, ekran wygląda
          jak ciemniejsza wersja siebie, a nie jak błąd.

          Landing maluje własne tło na całą wysokość (.jesien) i tę warstwę
          przykrywa.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-noc bg-cover bg-center"
          style={{ backgroundImage: "url(/grafika/tlo-apki.webp)" }}
        />
        {children}
      </body>
    </html>
  );
}
