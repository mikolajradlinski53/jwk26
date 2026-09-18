"use client";

import { useSyncExternalStore } from "react";
import { odliczanie, type Odliczanie } from "@/lib/odliczanie";

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
  poczatkowe,
  rozmiar = "zwykly",
}: {
  docelowa: string | null;
  etykieta: string;
  poTerminie: string;
  /**
   * Odliczanie policzone na serwerze, dla pierwszej klatki.
   *
   * Bez tego licznik pokazywał kreskę, dopóki nie doładował się JavaScript —
   * a licznik do wyjazdu jest jednym z dwóch elementów sekcji wejściowej
   * landinga, którą spec każe uczynić czytelną w pierwszej klatce. Landing
   * promujemy na Instagramie, więc trafia też do ludzi na słabym łączu.
   *
   * To nie grozi rozjazdem hydracji: wartość jest zwykłą właściwością,
   * zamrożoną w chwili renderu serwerowego, więc serwer i klient renderują
   * dokładnie ten sam napis. Sekundy bywają wtedy o moment nieświeże
   * i przeskakują przy pierwszym tyknięciu — niewidoczne w praktyce, a cena
   * za pokazanie prawdziwej liczby dni od razu.
   */
  poczatkowe: Odliczanie;
  /**
   * `"duzy"` to wariant sekcji wejściowej: cyfry mają być pierwszą rzeczą,
   * którą widać po logo, więc rosną z `text-3xl` do `text-6xl`, a karta
   * dostaje więcej powietrza. Reszta landingu (licznik przyjęcia świeżaków)
   * zostaje przy `"zwykly"`, żeby nie konkurował z hero.
   */
  rozmiar?: "zwykly" | "duzy";
}) {
  const teraz = useSyncExternalStore(subskrybuj, terazMs, terazNaSerwerze);
  const w = teraz === null ? poczatkowe : odliczanie(docelowa, new Date(teraz));

  const opis = w.minelo
    ? `${etykieta}: ${poTerminie}`
    : `${etykieta}: za ${w.dni} dni, ${w.godziny} godzin, ${w.minuty} minut`;

  const duzy = rozmiar === "duzy";

  return (
    <div
      className={`grid gap-3 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5 ${
        duzy ? "min-[600px]:p-7" : ""
      }`}
    >
      {/* Opis w ukrytym akapicie, nie w `aria-label` na tym kontenerze:
          `aria-label` na zwykłym `div` bez roli bywa przez czytniki ekranu
          pomijany, bo element nie ma roli, której nazwę dałoby się nadać.
          Ukryty tekst czyta się zawsze i nie zależy od implementacji. */}
      <p className="sr-only">{opis}</p>

      <p
        className={`text-xs uppercase tracking-wide text-jesien-kora ${duzy ? "min-[600px]:text-sm" : ""}`}
        aria-hidden="true"
      >
        {etykieta}
      </p>

      {w.minelo ? (
        <p
          className={`font-tytul text-jesien-rdza ${duzy ? "text-4xl min-[600px]:text-5xl" : "text-2xl"}`}
          aria-hidden="true"
        >
          {poTerminie}
        </p>
      ) : (
        <div className={duzy ? "flex gap-3 min-[600px]:gap-6" : "flex gap-4"} aria-hidden="true">
          {JEDNOSTKI.map(({ klucz, skrot }) => (
            <div key={klucz} className="grid justify-items-center">
              <span
                className={`font-tytul leading-none tabular-nums text-jesien-atrament ${
                  duzy ? "text-4xl min-[400px]:text-5xl min-[600px]:text-6xl" : "text-3xl"
                }`}
              >
                {String(w[klucz]).padStart(2, "0")}
              </span>
              <span
                className={`mt-1 text-jesien-kora ${duzy ? "text-[0.65rem] min-[600px]:text-xs" : "text-[0.6rem]"}`}
              >
                {skrot}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
