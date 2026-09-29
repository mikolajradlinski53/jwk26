import { ViewTransition } from "react";
import { RUCH } from "@/components/Ekran";

// Ten sam ruch co w Ekran: przy wejściu głębiej szkielet wjeżdża z prawej,
// przy powrocie z lewej, zakładki się przenikają.

/**
 * Szkielet ekranu na czas, gdy serwer składa nowy. Bez niego dotknięcie
 * zakładki albo linku nie zmieniało niczego przez pół sekundy — apka czekała
 * na odpowiedź, zanim cokolwiek pokazała, więc wyglądała na zawieszoną.
 * Next pobiera ten plik z wyprzedzeniem razem z linkami, więc pojawia się
 * od razu po dotknięciu, a zakładka w pasku przełącza się w tej samej chwili.
 */
export default function Ladowanie() {
  return (
    <ViewTransition enter={RUCH} exit={RUCH} default={RUCH}>
      <section className="mx-auto w-full max-w-md px-4 pb-10" aria-busy="true" aria-label="Ładowanie">
        <header className="grid justify-items-center gap-2 px-1 pb-4 pt-4">
          <div className="h-8 w-40 animate-pulse rounded-md bg-white/10" />
          <div className="h-3 w-28 animate-pulse rounded-md bg-white/5" />
        </header>
        <div className="grid gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="szklo h-16 animate-pulse rounded-md" />
          ))}
        </div>
      </section>
    </ViewTransition>
  );
}
