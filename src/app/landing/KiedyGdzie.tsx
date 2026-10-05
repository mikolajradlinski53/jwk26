import Image from "next/image";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { Mapa } from "./Mapa";
import { ZabaStala } from "./zaba/ZabaStala";
import { DATY_WYJAZDU, type OdslonaWidok } from "@/lib/odslony";

const TLO = "bg-jesien-tlo/70";

function Daty() {
  return <p className="text-sm font-bold text-jesien-atrament">{DATY_WYJAZDU} 2026 - od piątku do niedzieli</p>;
}

/**
 * „Gdzie się widzimy?” (dawniej „Kiedy i gdzie”). Daty jawne zawsze; ośrodek (zdjęcia, nazwa, adres, mapa)
 * dopiero po odsłonie. Zdjęcia leżą pod losowymi nazwami, a ich opisy nie
 * trafiają na stronę przed odsłoną - renderuje je tylko druga gałąź.
 *
 * Wyłącznie zdjęcia samego ośrodka - zdjęcia z ludźmi należą do galerii.
 */
export function KiedyGdzie({
  odslona,
  nazwa,
  adres,
}: {
  odslona: OdslonaWidok;
  nazwa: string | null;
  adres: string | null;
}) {
  if (!odslona.odsloniete) {
    return (
      <Zaslona
        id="kiedy-gdzie"
        numer="03"
        nadtytul="Lokalizacja"
        tytul="Gdzie się widzimy?"
        tlo={TLO}
        ksztalt="osrodek"
        odslona={odslona}
        zaba={<ZabaStala poza="lornetka" skala={0.95} polozenie={{ bottom: 0, right: "calc(100% + 8px)" }} />}
      >
        <Daty />
      </Zaslona>
    );
  }

  return (
    <section id="kiedy-gdzie" className={`${TLO} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="03" nadtytul="Lokalizacja" tytul="Gdzie się widzimy?" zaba={<ZabaStala poza="lornetka" skala={1} />} />
        <Daty />
        <div className="mt-4 grid grid-cols-[1.7fr_1fr] gap-2.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src="/hero/o-4c8e1a.jpg"
              alt=""
              fill
              sizes="(min-width: 850px) 460px, 55vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src="/hero/o-9b2d7f.jpg"
              alt=""
              fill
              sizes="(min-width: 850px) 220px, 33vw"
              className="object-cover"
            />
          </div>
        </div>
        {(nazwa || adres) && (
          <div className="mt-4 grid gap-3 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
            <div>
              {nazwa && <p className="text-sm font-bold text-jesien-atrament">{nazwa}</p>}
              {adres && <p className="text-sm text-jesien-kora">{adres}</p>}
            </div>
            {adres && <Mapa nazwa={nazwa} adres={adres} />}
          </div>
        )}
      </Kontener>
    </section>
  );
}
