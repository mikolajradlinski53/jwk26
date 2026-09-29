import { ViewTransition } from "react";

// Kierunek wynika z typu przejścia na linku: zakładki paska przenikają się,
// wejście głębiej odjeżdża w lewo, powrót w prawo. Bez typu (odświeżenie,
// systemowe „wstecz”) - bez animacji. Opakowanie jest tutaj, w ekranie, a nie
// w layoucie: layout przeżywa nawigację, więc enter/exit by się nie odpaliły.
//
// Ta sama mapa w `default`, nie tylko w enter/exit: przy zmianie strony Next
// potrafi potraktować ekran jako aktualizację, a nie wymianę - wtedy liczy
// się `default`, a z „none” nie działo się nic poza domyślnym przenikaniem
// całej strony (sprawdzone pomiarem animacji w Chrome).
export const RUCH = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  zakladka: "przenikanie",
  default: "none",
};

export function Ekran({
  tytul,
  podtytul,
  naglowek,
  children,
}: {
  tytul: string;
  podtytul?: string;
  /** Własny nagłówek zamiast tytułu i podtytułu (np. logo w feedzie). `tytul` zostaje w etykiecie sekcji. */
  naglowek?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ViewTransition enter={RUCH} exit={RUCH} default={RUCH}>
      <section className="mx-auto w-full max-w-md px-4 pb-10" aria-label={naglowek ? tytul : undefined}>
        {/* Odstęp na wcięcie ekranu daje `body` przez env(safe-area-inset-top),
            więc tutaj zostaje tylko oddech typograficzny. Wcześniejsze `pt-7`
            było dobrane pod widok z paskiem adresu i w trybie aplikacji
            zostawało jako pusta przestrzeń. */}
        <header className="px-1 pb-4 pt-4 text-center">
          {naglowek ?? (
            <>
              <h1 className="font-tytul text-[1.7rem] leading-tight tracking-tight text-kosc">
                {tytul}
              </h1>
              {podtytul && <p className="mt-1.5 text-xs text-dym">{podtytul}</p>}
            </>
          )}
        </header>
        {children}
      </section>
    </ViewTransition>
  );
}
