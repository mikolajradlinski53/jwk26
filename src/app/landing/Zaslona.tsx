import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { LicznikOdslony } from "./LicznikOdslony";
import type { OdslonaWidok } from "@/lib/odslony";

/**
 * Rozmyte kształty udające treść. Nie powstają z prawdziwej treści — to
 * stały rysunek, więc nic nie da się z niego odczytać.
 */
function Atrapa({ ksztalt }: { ksztalt: "osrodek" | "cena" }) {
  if (ksztalt === "osrodek") {
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-[1.7fr_1fr] gap-2.5">
          <div className="aspect-[4/3] rounded-lg bg-jesien-kora/20" />
          <div className="aspect-[4/3] rounded-lg bg-jesien-mech/25" />
        </div>
        <div className="grid gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
          <div className="h-3.5 w-2/5 rounded-full bg-jesien-atrament/25" />
          <div className="h-3 w-3/5 rounded-full bg-jesien-rdza/25" />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="h-14 w-40 rounded-md bg-jesien-rdza/30" />
      <div className="h-3 w-3/5 rounded-full bg-jesien-atrament/25" />
      <div className="h-3 w-4/5 rounded-full bg-jesien-kora/20" />
      <div className="mt-3 h-36 rounded-lg border-2 border-dashed border-jesien-dynia/50 bg-jesien-tlo/60" />
    </div>
  );
}

/**
 * Sekcja pod zasłoną: nagłówek widoczny, pod nim atrapa i licznik. Czytnik
 * ekranu słyszy datę odsłony, nie tykające cyfry.
 */
export function Zaslona({
  id,
  numer,
  nadtytul,
  tytul,
  tlo,
  ksztalt,
  odslona,
  children,
}: {
  id: string;
  numer: string;
  nadtytul: string;
  tytul: string;
  /** Klasa tła sekcji, ta sama co w odsłoniętej wersji — rytm strony się nie zmienia. */
  tlo: string;
  ksztalt: "osrodek" | "cena";
  odslona: OdslonaWidok;
  /** Treść jawna przed odsłoną, nad atrapą (np. daty w „Kiedy i gdzie”). */
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className={`${tlo} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer={numer} nadtytul={nadtytul} tytul={tytul} />
        {children}
        <div className="relative mt-4">
          <div aria-hidden="true" className="pointer-events-none select-none blur-[6px]">
            <Atrapa ksztalt={ksztalt} />
          </div>
          <div className="absolute inset-0 grid place-items-center p-4">
            <div
              className="grid justify-items-center gap-1 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/90
                         px-6 py-4 text-center shadow-[0_14px_30px_-18px_rgb(47_33_24/0.5)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Odsłonimy za</p>
              <LicznikOdslony
                data={odslona.data}
                poczatkowy={odslona.poczatkowy}
                className="text-3xl text-jesien-atrament"
              />
              <p className="sr-only">Odsłonimy {odslona.kiedy}.</p>
            </div>
          </div>
        </div>
      </Kontener>
    </section>
  );
}
