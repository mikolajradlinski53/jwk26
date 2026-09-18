import Image from "next/image";
import { Zaba } from "@/components/Zaba";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/**
 * Materiały tej edycji jeszcze nie istnieją — właściciel dopiero je nagra.
 * Zamiast pustego stanu sekcja pokazuje galerię zdjęć z poprzednich edycji
 * (podpisaną jako taka) i wyraźną ramkę-miejsce na film promocyjnej tej
 * edycji, proporcje 16:9. Ramka jest ważna: właściciel planuje, że maskotka
 * (`Zaba`) będzie ją „trzymać" — stąd pozycjonowanie zachodzące na górny
 * lewy róg ramki.
 */
const GALERIA: { plik: string; alt: string; szeroka?: boolean }[] = [
  {
    plik: "hero-1",
    alt: "Grupowe zdjęcie uczestników na trawie z poprzedniej edycji wyjazdu",
    szeroka: true,
  },
  {
    plik: "hero-2",
    alt: "Trzy uczestniczki poprzedniej edycji w kurtkach z kapturami, wieczorem przed ośrodkiem",
  },
  {
    plik: "hero-3",
    alt: "Troje uczestników poprzedniej edycji pozuje razem nocą, zdjęcie z lampą błyskową",
  },
  {
    plik: "hero-4",
    alt: "Troje uczestników poprzedniej edycji pozuje razem nocą, zdjęcie z lampą błyskową",
  },
  {
    plik: "hero-10",
    alt: "Uczestnicy poprzedniej edycji pozują do zdjęcia podczas wieczornej zabawy w sali ośrodka",
  },
];

export function Promocja() {
  return (
    <section id="promocja" className="bg-jesien-karta mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="02" nadtytul="Materiały" tytul="Zapowiedź" />

        <p className="text-sm leading-relaxed text-jesien-kora">
          Zdjęcia i film z tej edycji pojawią się tutaj, gdy tylko powstaną.
          Na razie — jak było poprzednim razem.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {GALERIA.map((zdjecie) => (
            <div
              key={zdjecie.plik}
              className={`relative overflow-hidden rounded-md bg-jesien-tlo ${
                zdjecie.szeroka ? "col-span-2 aspect-[16/9]" : "aspect-square"
              }`}
            >
              <Image
                src={`/hero/${zdjecie.plik}.jpg`}
                alt={zdjecie.alt}
                fill
                sizes="(min-width: 600px) 340px, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-jesien-kora/80">Zdjęcia z poprzednich edycji.</p>

        <div className="relative mt-10">
          <div
            className="relative flex aspect-video w-full flex-col items-center justify-center gap-1.5
                       rounded-lg border-2 border-dashed border-jesien-dynia/60 bg-jesien-tlo/70 px-6 text-center"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">
              Wkrótce
            </p>
            <p className="max-w-[260px] text-sm text-jesien-kora">
              Film promocyjny tej edycji pojawi się tutaj, gdy tylko powstanie.
            </p>
          </div>

          <Zaba
            stan="powitanie"
            className="absolute -top-7 -left-3 size-16 text-jesien-mech
                       drop-shadow-[0_6px_14px_rgb(47_33_24/0.3)] min-[600px]:-top-8 min-[600px]:size-20"
          />
        </div>
      </Kontener>
    </section>
  );
}
