"use client";

import { useSyncExternalStore } from "react";
import { odliczanie } from "@/lib/odliczanie";

function subskrybuj(powiadom: () => void) {
  const id = setInterval(powiadom, 1000);
  return () => clearInterval(id);
}

function terazMs() {
  return Date.now();
}

// Serwer nie zna chwili, w której klient wykona hydratację — a `Date.now()`
// wywołane osobno po obu stronach dałoby dwie różne wartości i ostrzeżenie
// o rozjeździe. `null` znaczy „jeszcze nie wiadomo" i jest identyczne
// na serwerze i w pierwszej klatce klienta; prawdziwy czas przychodzi dopiero
// po zamontowaniu, przez subskrypcję powyżej — nie przez `setState` wywołane
// wprost w ciele efektu (to łapie reguła `react-hooks/set-state-in-effect`).
function terazNaSerwerze() {
  return null;
}

const JEDNOSTKI = [
  { klucz: "dni", skrot: "dni" },
  { klucz: "godziny", skrot: "godz" },
  { klucz: "minuty", skrot: "min" },
  { klucz: "sekundy", skrot: "sek" },
] as const;

/**
 * Odliczanie do daty wydarzenia.
 *
 * Pierwsza klatka (serwer i hydratacja) nie liczy niczego — `teraz` jest
 * wtedy `null`, więc karta pokazuje neutralny placeholder zamiast cyfr.
 * Realne wartości dochodzą po zamontowaniu, gdy zaczyna tykać `setInterval`
 * w `subskrybuj`. Dzięki temu serwer i klient renderują to samo w pierwszej
 * klatce i hydratacja się nie wywraca.
 *
 * Bez `aria-live`: licznik zmienia się co sekundę i czytnik ekranu
 * recytowałby cyfry bez końca. Zamiast tego cała karta ma jeden opisowy
 * `aria-label`, a cyfry są `aria-hidden`, żeby się nie dublowały.
 */
export function Licznik({
  docelowa,
  etykieta,
  poTerminie,
}: {
  docelowa: string | null;
  etykieta: string;
  poTerminie: string;
}) {
  const teraz = useSyncExternalStore(subskrybuj, terazMs, terazNaSerwerze);
  const w = teraz === null ? null : odliczanie(docelowa, new Date(teraz));

  const opis =
    w === null
      ? `${etykieta}: liczę…`
      : w.minelo
        ? `${etykieta}: ${poTerminie}`
        : `${etykieta}: za ${w.dni} dni, ${w.godziny} godzin, ${w.minuty} minut`;

  return (
    <div className="szklo grid gap-3 rounded-lg p-5" aria-label={opis}>
      <p className="text-xs uppercase tracking-wide text-dym">{etykieta}</p>

      {w === null || w.minelo ? (
        <p className="font-tytul text-2xl text-krew-jasna" aria-hidden="true">
          {w === null ? "—" : poTerminie}
        </p>
      ) : (
        <div className="flex gap-4" aria-hidden="true">
          {JEDNOSTKI.map(({ klucz, skrot }) => (
            <div key={klucz} className="grid justify-items-center">
              <span className="font-tytul text-3xl leading-none tabular-nums text-kosc">
                {String(w[klucz]).padStart(2, "0")}
              </span>
              <span className="mt-1 text-[0.6rem] text-dym">{skrot}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
