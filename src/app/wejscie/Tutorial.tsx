"use client";

import { useState, useSyncExternalStore } from "react";
import { system, wbudowanaPrzegladarka, type System } from "@/lib/urzadzenie";
import { Button } from "@/components/ui/Button";

// Wartości nie zmieniają się w czasie życia strony — subskrypcja jest pusta,
// to wyłącznie sposób odczytania ich dopiero po stronie klienta.
function bezSubskrypcji() {
  return () => {};
}

/**
 * Rozpoznanie dopiero po stronie klienta, przez useSyncExternalStore zamiast
 * useEffect + setState.
 *
 * Na serwerze nie ma navigatora, a rozjazd między serwerem a klientem
 * wywaliłby hydrację — `getServerSnapshot` zwraca więc bezpieczną wartość
 * początkową, a React sam dogrywa właściwą zaraz po hydracji. Wariant
 * z `useEffect` wołającym `setState` w ciele odrzuca tu eslint
 * (react-hooks/set-state-in-effect): woła setState synchronicznie w efekcie,
 * co reguła traktuje jako kaskadowy rerender do uniknięcia.
 */
export function Tutorial() {
  const sys = useSyncExternalStore<System | null>(
    bezSubskrypcji,
    () => system(),
    () => null,
  );
  const wAplikacji = useSyncExternalStore(
    bezSubskrypcji,
    () => wbudowanaPrzegladarka(),
    () => false,
  );
  const [skopiowano, setSkopiowano] = useState(false);

  async function skopiujAdres() {
    await navigator.clipboard.writeText(window.location.origin);
    setSkopiowano(true);
  }

  if (sys === null) return null;

  if (wAplikacji) {
    return (
      <div className="szklo grid gap-4 rounded-lg p-5">
        <p className="text-sm text-kosc">
          Otworzyłeś to w przeglądarce Instagrama, a ona nie potrafi dodawać
          aplikacji do ekranu głównego. Otwórz ten adres w Safari albo Chrome.
        </p>
        <Button onClick={skopiujAdres}>
          {skopiowano ? "Skopiowano adres" : "Skopiuj adres"}
        </Button>
      </div>
    );
  }

  const kroki =
    sys === "ios"
      ? [
          "Naciśnij przycisk Udostępnij na dolnym pasku Safari.",
          "Przewiń listę i wybierz „Do ekranu początkowego”.",
          "Naciśnij Dodaj w prawym górnym rogu.",
        ]
      : sys === "android"
        ? [
            "Naciśnij menu trzech kropek w prawym górnym rogu.",
            "Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.",
            "Potwierdź.",
          ]
        : [
            "Otwórz tę stronę na telefonie.",
            "Dodaj ją do ekranu głównego z menu przeglądarki.",
          ];

  return (
    <div className="szklo grid gap-4 rounded-lg p-5">
      <p className="text-sm text-kosc">
        Sekta mieszka na ekranie głównym, nie w przeglądarce. Przypnij ją,
        a potem otwórz stąd — inaczej nie dostaniesz powiadomień.
      </p>
      <ol className="grid list-decimal gap-2 pl-5 text-sm text-dym">
        {kroki.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ol>
    </div>
  );
}
