"use client";

import { usePathname } from "next/navigation";

/**
 * Trasy bez zamka instalacji (decyzja Mikołaja 2026-10-07): zapisy ruszają
 * o 12:00 i wygrywa szybkość - kazanie najpierw instalować apkę kosztowało
 * minutę lub dwie i gubiło ludzi po drodze. Instalacja przychodzi później
 * (przed wyjazdem i tak jest potrzebna do powiadomień na iPhonie).
 */
const BEZ_ZAMKA = ["/app/rejestracja"];

/**
 * Część zamka zależna od ścieżki. Na trasie bez zamka treść idzie wprost -
 * z jednym wyjątkiem: w przeglądarce wbudowanej (Instagram, Messenger…)
 * logowanie Google nie działa, więc ekran wejścia pokazuje wtedy „otwórz
 * w Safari albo Chrome” zamiast formularza, który i tak by się wyłożył.
 * Wszędzie indziej - stary zamek na CSS (`display-mode`).
 */
export function ZamekKlient({
  tutorial,
  wbudowana,
  zwolnione = false,
  children,
}: {
  tutorial: React.ReactNode;
  wbudowana: boolean;
  /** Zwolnienie nadane przez stronę (ekran wejścia), niezależnie od ścieżki. */
  zwolnione?: boolean;
  children: React.ReactNode;
}) {
  const sciezka = usePathname();
  const bezZamka = zwolnione || BEZ_ZAMKA.includes(sciezka);

  if (bezZamka) {
    if (zwolnione && wbudowana) return <>{tutorial}</>;
    return <>{children}</>;
  }

  return (
    <>
      <div className="tylko-w-przegladarce">{tutorial}</div>
      <div className="tylko-w-apce">{children}</div>
    </>
  );
}
