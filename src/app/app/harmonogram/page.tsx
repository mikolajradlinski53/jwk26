import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Pusto } from "@/components/Pusto";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import {
  grupujPoDniach,
  krotkaGodzina,
  nazwaDnia,
  type PunktHarmonogramu,
} from "@/lib/harmonogram";

/** Program wyjazdu dzień po dniu. Edytuje go admin w Sanktuarium. */
export default async function HarmonogramPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("harmonogram")
    .select("id, dzien, godzina, tytul, opis")
    .order("dzien")
    .order("godzina", { nullsFirst: true });

  const dni = grupujPoDniach((data ?? []) as PunktHarmonogramu[]);

  return (
    <Ekran tytul="Harmonogram" podtytul="Co, kiedy i gdzie">
      {error && (
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać harmonogramu. Odśwież stronę.
        </p>
      )}
      {!error && dni.length === 0 && (
        <Pusto ikona="zegar">Program pojawi się tu, gdy organizator go ogłosi.</Pusto>
      )}

      {dni.map((d) => (
        <section key={d.dzien}>
          <NaglowekSekcji>{nazwaDnia(d.dzien)}</NaglowekSekcji>
          <ol className="szklo grid rounded-md px-4 py-1">
            {d.punkty.map((p) => (
              <li key={p.id} className="flex gap-4 border-b border-white/8 py-3.5 last:border-b-0">
                <span className="w-12 flex-none pt-0.5 font-tytul text-lg leading-none tabular-nums text-krew-jasna">
                  {krotkaGodzina(p.godzina) ?? "-"}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-kosc">{p.tytul}</h3>
                  {p.opis && (
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-popiol">{p.opis}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <Wroc href="/app/wiecej">Wróć</Wroc>
    </Ekran>
  );
}
