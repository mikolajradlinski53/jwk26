import { ZabaStala } from "./zaba/ZabaStala";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Posty } from "./Posty";
import { POSTY } from "./aktualnosciDane";

/**
 * „Aktualności” - tu prowadzi przycisk z hero. Posty z social mediów
 * (aktualnosciDane.ts) z opisem po kliknięciu; bez postów niski pasek
 * „wkrótce” z żabą, która „trzyma” go za lewy róg.
 */
export function Aktualnosci() {
  return (
    <section id="aktualnosci" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="08" nadtytul="Aktualności" tytul="Materiały z tej edycji" />

        {POSTY.length > 0 ? (
          <Posty />
        ) : (
          <div className="relative mt-16 rounded-lg border-2 border-dashed border-jesien-dynia/60 bg-jesien-tlo/70 py-5 pl-28 pr-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Wkrótce</p>
            <p className="text-sm text-jesien-kora">Materiały z JWK26 pojawią się tutaj.</p>
            <ZabaStala poza="ramka" skala={1} className="absolute bottom-0 left-3" />
          </div>
        )}
      </Kontener>
    </section>
  );
}
