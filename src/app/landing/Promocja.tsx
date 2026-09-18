import { Zaba } from "@/components/Zaba";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Galeria } from "./Galeria";

/**
 * Materiały tej edycji jeszcze nie istnieją — właściciel dopiero je nagra.
 * Zamiast pustego stanu sekcja pokazuje galerię zdjęć z poprzednich edycji
 * (`Galeria`) i wyraźną ramkę-miejsce na film promocyjny tej edycji,
 * proporcje 16:9. Ramka jest ważna: właściciel planuje, że maskotka (`Zaba`)
 * będzie ją „trzymać" — stąd pozycjonowanie zachodzące na górny lewy róg ramki.
 */
export function Promocja() {
  return (
    <section id="promocja" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="02" nadtytul="Materiały" tytul="Zapowiedź" />

        <p className="text-sm leading-relaxed text-jesien-kora">
          Zdjęcia i film z tej edycji pojawią się tutaj, gdy tylko powstaną.
          Na razie — jak było poprzednim razem.
        </p>

        <div className="mt-6">
          <Galeria />
        </div>

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
