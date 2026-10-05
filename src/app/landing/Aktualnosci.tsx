import { ZabaStala } from "./zaba/ZabaStala";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/**
 * Materiały promocyjne tej edycji. Dodanie = plik w `public/aktualnosci/`
 * i wpis tutaj, np. `{ src: "/aktualnosci/zapowiedz.mp4", plakat: "/aktualnosci/zapowiedz.jpg" }`
 * dla filmu albo `{ src: "/aktualnosci/plakat.jpg" }` dla grafiki.
 */
const MATERIALY: { src: string; plakat?: string }[] = [];

/**
 * „Aktualności” - tu prowadzi przycisk z hero. Do pierwszego materiału niski
 * pasek „wkrótce” z żabą, która „trzyma” go za lewy róg.
 */
export function Aktualnosci() {
  return (
    <section id="aktualnosci" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="08" nadtytul="Aktualności" tytul="Materiały z tej edycji" />

        {MATERIALY.length > 0 ? (
          <div className="grid gap-4 min-[850px]:grid-cols-2">
            {MATERIALY.map((m) =>
              m.src.endsWith(".mp4") ? (
                <video
                  key={m.src}
                  controls
                  preload="none"
                  poster={m.plakat}
                  className="aspect-video w-full rounded-lg bg-jesien-atrament"
                >
                  <source src={m.src} type="video/mp4" />
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- grafiki promocyjne w dowolnych proporcjach
                <img key={m.src} src={m.src} alt="" loading="lazy" className="w-full rounded-lg" />
              ),
            )}
          </div>
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
