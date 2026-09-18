export type StanZaby = "powitanie" | "tutorial" | "odmowa" | "czekanie" | "sukces";

const OPISY: Record<StanZaby, string> = {
  powitanie: "Żaba wita uczestników przed wejściem do Sekty",
  tutorial: "Żaba pokazuje, jak przypiąć aplikację do ekranu głównego",
  odmowa: "Żaba przy komunikacie o odmowie logowania",
  czekanie: "Żaba czeka razem z Tobą na akceptację zgłoszenia",
  sukces: "Żaba świętuje pierwsze wejście do aplikacji",
};

/**
 * Maskotka wydarzenia — gniazda i stany, nie finalny wygląd.
 *
 * Właściwej grafiki jeszcze nie ma, właściciel ją dostarczy. Do tego czasu
 * rysujemy prostą sylwetkę zastępczą w SVG, żeby brak rysunku nie blokował
 * budowy ani nie zostawiał dziury w układzie. To NIE jest finalna maskotka —
 * to placeholder.
 *
 * PODMIANA: gdy pliki trafią do `public/zaba/<stan>.png` (albo `.svg`),
 * zamień treść tej funkcji na `<img src={`/zaba/${stan}.png`} alt={OPISY[stan]}
 * className={className} />` — sygnatura komponentu (props `stan`, `className`)
 * może zostać bez zmian, więc żadne miejsce wywołania nie wymaga edycji.
 *
 * Kolor sylwetki dziedziczy się z `currentColor` — miejsce wstawienia decyduje
 * o czytelności przez klasę tekstową w `className`. Landing (jasne tło) używa
 * np. `text-jesien-mech`, apka (ciemne tło) np. `text-kosc` albo
 * `text-krew-jasna` — obie kombinacje mają sprawdzony kontrast.
 */
export function Zaba({ stan, className = "" }: { stan: StanZaby; className?: string }) {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label={OPISY[stan]} className={className}>
      <g fill="currentColor">
        <ellipse cx="60" cy="60" rx="46" ry="32" />
        <circle cx="34" cy="26" r="16" />
        <circle cx="86" cy="26" r="16" />
        <ellipse cx="18" cy="80" rx="12" ry="9" />
        <ellipse cx="102" cy="80" rx="12" ry="9" />
      </g>
    </svg>
  );
}
