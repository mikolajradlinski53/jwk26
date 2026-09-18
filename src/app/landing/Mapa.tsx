"use client";

import { useState } from "react";
import { Kontener } from "./Kontener";

const ADRES = "OW Zielone Wzgórze, Poznańska 5, 58-540 Karpacz";
const ADRES_KODOWANY = encodeURIComponent(ADRES);
const URL_OSADZENIA = `https://maps.google.com/maps?q=${ADRES_KODOWANY}&output=embed`;
const URL_MAPY = `https://www.google.com/maps/search/?api=1&query=${ADRES_KODOWANY}`;

/**
 * Osadzona mapa — dopełnienie sekcji „Kiedy i gdzie", nie jej zastępstwo.
 * Renderuje się bezpośrednio pod `KiedyGdzie` (to samo tło `jesien-tlo/70`,
 * zerowy odstęp od góry, brak dzielnika między nimi), więc czyta się jak
 * jedna sekcja, a nie dwie osobne — stąd też brak własnego `SekcjaNaglowek`
 * z numerem: to podpunkt „Kiedy i gdzie", a nie nowy temat.
 *
 * Ładowanie na kliknięcie, nie na `IntersectionObserver`: adres jest już
 * widoczny (i klikalny jako zwykły odnośnik) w karcie `KiedyGdzie` tuż nad
 * tym miejscem, więc mapa rzadko jest pierwszą rzeczą, po którą ktoś
 * scrolluje — a ta strona promuje się na Instagramie, czyli trafia też do
 * osób na słabym łączu i limicie danych. Ładowanie „na wjechanie w widok"
 * ściągnęłoby ciężki iframe każdemu, kto po prostu przewinął stronę do
 * końca, nawet bez zamiaru patrzenia na mapę. Kliknięcie jest jawną decyzją,
 * nie zależy od szybkości przewijania i jest prostsze do zweryfikowania.
 *
 * Stan trzyma zwykły `useState` ustawiany w handlerze kliknięcia — nie
 * w `useEffect` — więc reguła `react-hooks/set-state-in-effect` nie ma tu
 * zastosowania. Zanim mapa się załaduje, w DOM nie ma żadnego `<iframe>`
 * wskazującego na maps.google.com.
 */
export function Mapa() {
  const [pokazMape, setPokazMape] = useState(false);

  return (
    <section id="mapa" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 pt-0 pb-14">
      <Kontener wariant="szeroki">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">
          Trasa dojazdu
        </h3>

        {pokazMape ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg min-[850px]:aspect-[21/9]">
            <iframe
              src={URL_OSADZENIA}
              title={`Mapa: ${ADRES}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0"
            />
          </div>
        ) : (
          <div
            className="relative flex aspect-video w-full flex-col items-center justify-center gap-3
                       rounded-lg border border-jesien-kora/15 bg-jesien-karta px-6 text-center
                       min-[850px]:aspect-[21/9]"
          >
            <p className="text-sm font-bold text-jesien-atrament">{ADRES}</p>
            <button
              type="button"
              onClick={() => setPokazMape(true)}
              className="flex min-h-11 items-center justify-center rounded-full border border-jesien-rdza/40
                         bg-jesien-tlo px-5 text-sm font-bold text-jesien-rdza transition hover:bg-jesien-rdza
                         hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-jesien-rdza"
            >
              Pokaż mapę
            </button>
          </div>
        )}

        <a
          href={URL_MAPY}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-jesien-rdza underline underline-offset-2"
        >
          Otwórz w Google Maps
        </a>
      </Kontener>
    </section>
  );
}
