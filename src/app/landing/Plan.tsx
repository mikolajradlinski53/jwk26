import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { ZabaStala } from "./zaba/ZabaStala";
import { grupujPoDniach, krotkaGodzina, nazwaDnia, type PunktHarmonogramu } from "@/lib/harmonogram";
import type { OdslonaWidok } from "@/lib/odslony";

/**
 * Plan z harmonogramu — wyłącznie punkty oznaczone przez admina „na landing”
 * (odczyt `anon` i tak nie widzi innych). Do odsłony planu (dzień wyjazdu,
 * 14:00) zasłona z licznikiem; po odsłonie bez punktów sekcji nie ma.
 */
export function Plan({ punkty, odslona }: { punkty: PunktHarmonogramu[]; odslona: OdslonaWidok }) {
  if (!odslona.odsloniete) {
    return (
      <Zaslona
        id="plan"
        numer="02"
        nadtytul="Program"
        tytul="Plan wyjazdu"
        tlo="bg-jesien-karta/70"
        ksztalt="plan"
        odslona={odslona}
        zaba={<ZabaStala poza="podglada" skala={0.9} polozenie={{ bottom: "calc(100% - 9px)", left: "50%", transform: "translateX(-50%)" }} />}
      />
    );
  }
  const dni = grupujPoDniach(punkty);
  if (dni.length === 0) return null;

  return (
    <section id="plan" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="02" nadtytul="Program" tytul="Plan wyjazdu" />
        <div className="grid gap-4 min-[850px]:grid-cols-3">
          {dni.map((d) => (
            <div key={d.dzien} className="rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">{nazwaDnia(d.dzien)}</h3>
              <ol className="mt-3 grid gap-3">
                {d.punkty.map((p) => (
                  <li key={p.id} className="flex gap-3">
                    <span className="w-11 flex-none font-tytul text-base leading-snug tabular-nums text-jesien-rdza">
                      {krotkaGodzina(p.godzina) ?? "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-jesien-atrament">{p.tytul}</p>
                      {p.opis && <p className="text-sm leading-relaxed text-jesien-kora">{p.opis}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Kontener>
    </section>
  );
}
