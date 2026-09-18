"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

export type StanZaby = "powitanie" | "tutorial" | "odmowa" | "czekanie" | "sukces";

const OPISY: Record<StanZaby, string> = {
  powitanie: "Żaba wita uczestników przed wejściem do Sekty",
  tutorial: "Żaba pokazuje, jak przypiąć aplikację do ekranu głównego",
  odmowa: "Żaba przy komunikacie o odmowie logowania",
  czekanie: "Żaba czeka razem z Tobą na akceptację zgłoszenia",
  sukces: "Żaba świętuje pierwsze wejście do aplikacji",
};

// Czas między klatkami animacji poklatkowej. ~8 klatek na sekundę — szybciej
// niż to nie ma sensu dla ręcznie malowanej sekwencji PNG, wolniej wygląda
// na przycinanie.
const MS_NA_KLATKE = 120;

/**
 * Maskotka wydarzenia — gniazda i stany, nie finalny wygląd.
 *
 * Właściwej grafiki jeszcze nie ma. Do czasu jej dostarczenia rysujemy prostą
 * sylwetkę zastępczą w SVG (gałąź bez `klatki`), żeby brak rysunku nie
 * blokował budowy ani nie zostawiał dziury w układzie. To NIE jest finalna
 * maskotka — to placeholder, i pozostaje domyślnym zachowaniem, gdy nikt nie
 * przekaże klatek.
 *
 * PODMIANA / PODPIĘCIE ANIMACJI:
 * 1. Wrzuć klatki PNG do `public/zaba/<nazwa-sekwencji>/`, ponumerowane
 *    (`01.png`, `02.png`, ...). Każda klatka powinna mieć to samo płótno
 *    (ten sam rozmiar i punkt zaczepienia), inaczej żaba będzie „skakać”
 *    w miejscu przy każdej zmianie klatki.
 * 2. Przekaż tablicę ścieżek przez prop `klatki`, np.:
 *      <Zaba stan="powitanie" klatki={[
 *        "/zaba/powitanie/01.png",
 *        "/zaba/powitanie/02.png",
 *        "/zaba/powitanie/03.png",
 *      ]} />
 * 3. Jedna klatka w tablicy = statyczny obrazek, bez animowania (podmiana
 *    1:1 pojedynczego pliku, żadnego interwału). Zero klatek albo brak propa
 *    = sylwetka zastępcza jak dotychczas.
 *
 * Animacja idzie przez `useSyncExternalStore`, tak jak licznik w `Licznik.tsx`
 * — indeks bieżącej klatki mieszka w refie, zmieniany przez `setInterval`
 * poza Reactem, subskrypcja tylko o tym powiadamia. Żadnego `setState`
 * wywołanego wprost w ciele efektu (reguła `react-hooks/set-state-in-effect`
 * jest w tym repozytorium twardym błędem), i żadnego rozjazdu serwer/klient:
 * `getServerSnapshot` zawsze zwraca 0, więc pierwsza klatka po obu stronach
 * jest identyczna.
 *
 * `prefers-reduced-motion: reduce` zatrzymuje sekwencję na pierwszej klatce —
 * `subskrybuj` w ogóle nie odpala interwału.
 *
 * Kolor sylwetki zastępczej dziedziczy się z `currentColor` — miejsce
 * wstawienia decyduje o czytelności przez klasę tekstową w `className`.
 * Landing (jasne tło) używa np. `text-jesien-mech`, apka (ciemne tło) np.
 * `text-kosc` albo `text-krew-jasna` — obie kombinacje mają sprawdzony
 * kontrast. Gdy `klatki` są PNG-ami, `className` nadal steruje rozmiarem
 * (np. `size-24`), ale nie kolorem — kolor jest wtedy w samym pliku.
 */
export function Zaba({
  stan,
  className = "",
  klatki,
}: {
  stan: StanZaby;
  className?: string;
  klatki?: string[];
}) {
  const indeksRef = useRef(0);

  const subskrybuj = useCallback(
    (powiadom: () => void) => {
      if (!klatki || klatki.length < 2) return () => {};
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

      const id = setInterval(() => {
        indeksRef.current = (indeksRef.current + 1) % klatki.length;
        powiadom();
      }, MS_NA_KLATKE);

      return () => clearInterval(id);
    },
    [klatki],
  );

  const getSnapshot = useCallback(() => indeksRef.current, []);
  const getServerSnapshot = useCallback(() => 0, []);

  const indeks = useSyncExternalStore(subskrybuj, getSnapshot, getServerSnapshot);

  if (klatki && klatki.length > 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- sekwencja PNG podpinana dynamicznie, poza next/image
      <img
        src={klatki[Math.min(indeks, klatki.length - 1)]}
        alt={OPISY[stan]}
        className={className}
      />
    );
  }

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
