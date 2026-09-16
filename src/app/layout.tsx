import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
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
  return (
    <html lang="pl" className={`${bodoni.variable} ${manrope.variable}`}>
      <body>
        {/*
          Poświata mieszka w warstwie globalnej, nie na ekranach. Bez niej
          backdrop-filter nie ma czego rozmywać i szkło zamienia się w szarą
          płytę. Jedno tło znaczy też, że każdy nowy ekran jest szklany od razu.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-[-30%] -z-10 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 24% 12%, rgb(200 16 46 / 0.5) 0%, transparent 44%)," +
              "radial-gradient(circle at 84% 30%, rgb(110 10 26 / 0.55) 0%, transparent 42%)," +
              "radial-gradient(circle at 50% 96%, rgb(200 16 46 / 0.3) 0%, transparent 46%)",
          }}
        />
        {children}
      </body>
    </html>
  );
}
