"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { odliczanie } from "@/lib/odliczanie";
import { tekstOdliczania } from "@/lib/odslony";

// Chwila trzymana poza Reactem i zmieniana tylko przy tyknięciu: `getSnapshot`
// musi zwracać tę samą wartość między tyknięciami, inaczej React ostrzega
// o niebuforowanej migawce (i w skrajnym razie zapętla render).
let teraz = Date.now();

function subskrybuj(powiadom: () => void) {
  teraz = Date.now();
  const id = setInterval(() => {
    teraz = Date.now();
    powiadom();
  }, 1000);
  return () => clearInterval(id);
}
function terazMs() {
  return teraz;
}
function terazNaSerwerze() {
  return null;
}

/**
 * Licznik do odsłony jako jedna linia tekstu. Pierwsza klatka to `poczatkowy`
 * z serwera (jak w `Licznik`). Na zerze prosi serwer o nową wersję strony -
 * bez przeładowania. Ponawia co 5 s, najwyżej sześć razy, bo zegar telefonu
 * bywa o kilka sekund przed zegarem bazy, a to baza decyduje o odsłonie.
 * Po odsłonie serwer przysyła sekcję bez licznika, więc komponent znika
 * razem ze swoim interwałem.
 */
export function LicznikOdslony({
  data,
  poczatkowy,
  className = "",
}: {
  data: string | null;
  poczatkowy: string;
  className?: string;
}) {
  const router = useRouter();
  const chwila = useSyncExternalStore(subskrybuj, terazMs, terazNaSerwerze);
  const w = chwila === null || !data ? null : odliczanie(data, new Date(chwila));
  const minelo = w?.minelo ?? false;

  useEffect(() => {
    if (!minelo) return;
    router.refresh();
    let proby = 1;
    const id = setInterval(() => {
      router.refresh();
      proby += 1;
      if (proby >= 6) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [minelo, router]);

  return (
    <span aria-hidden="true" className={`font-tytul tabular-nums ${className}`}>
      {w === null ? poczatkowy : tekstOdliczania(w)}
    </span>
  );
}
