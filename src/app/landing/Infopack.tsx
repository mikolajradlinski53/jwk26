import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { ZabaStala } from "./zaba/ZabaStala";
import type { OdslonaWidok } from "@/lib/odslony";

/**
 * Plik infopacku. Podmiana = plik w `public/` i jedna linia tutaj,
 * np. `"/infopack.pdf"`. Do tego czasu po odsłonie sekcja mówi „wkrótce”.
 */
const INFOPACK: string | null = null;

const TLO = "bg-jesien-tlo/70";

/**
 * „Infopack” - w miejscu dawnego „Co zabrać”. Własny termin odsłony
 * (22.10, 12:00 w Ustawieniach), niezależny od zapisów, jak harmonogram.
 */
export function Infopack({ odslona }: { odslona: OdslonaWidok }) {
  if (!odslona.odsloniete) {
    return (
      <Zaslona
        id="infopack"
        numer="07"
        nadtytul="Przygotowanie"
        tytul="Infopack"
        tlo={TLO}
        ksztalt="infopack"
        odslona={odslona}
        zaba={<ZabaStala poza="plecak" skala={0.85} polozenie={{ bottom: "calc(100% - 6px)", right: 4 }} />}
      />
    );
  }

  return (
    <section id="infopack" className={`${TLO} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener>
        <SekcjaNaglowek
          numer="07"
          nadtytul="Przygotowanie"
          tytul="Infopack"
          zaba={<ZabaStala poza="plecak" skala={0.95} />}
        />
        {INFOPACK ? (
          <div className="grid justify-items-start gap-4">
            <p className="text-sm leading-relaxed text-jesien-kora">
              Wszystko, co trzeba wiedzieć przed wyjazdem, w jednym miejscu.
            </p>
            <a
              href={INFOPACK}
              target="_blank"
              rel="noopener"
              className="flex min-h-12 items-center justify-center rounded-full bg-jesien-rdza px-6 text-sm font-bold
                         text-white transition hover:brightness-110 focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
            >
              Otwórz infopack
            </a>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-jesien-kora">Infopack pojawi się tutaj lada chwila.</p>
        )}
      </Kontener>
    </section>
  );
}
