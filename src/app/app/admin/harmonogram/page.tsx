import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { grupujPoDniach, nazwaDnia, type PunktHarmonogramu } from "@/lib/harmonogram";
import { FormularzPunktu, PunktDoEdycji } from "./Edytor";

/**
 * Edycja harmonogramu. Nowy punkt dostaje domyślnie pierwszy dzień wyjazdu
 * z ustawień, żeby admin nie przewijał kalendarza od dzisiaj.
 */
export default async function AdminHarmonogramPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: start }] = await Promise.all([
    supabase
      .from("harmonogram")
      .select("id, dzien, godzina, tytul, opis, na_landingu")
      .order("dzien")
      .order("godzina", { nullsFirst: true }),
    supabase.from("app_settings").select("value").eq("key", "data_jwk").maybeSingle(),
  ]);

  const dni = grupujPoDniach((data ?? []) as PunktHarmonogramu[]);
  const pierwszyDzien = typeof start?.value === "string" ? start.value.slice(0, 10) : "";

  return (
    <Ekran tytul="Harmonogram" podtytul="Program wyjazdu dzień po dniu">
      <FormularzPunktu domyslnyDzien={pierwszyDzien} />

      {error && (
        <p className="szklo mt-5 rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać harmonogramu. Odśwież stronę.
        </p>
      )}

      {dni.map((d) => (
        <section key={d.dzien}>
          <NaglowekSekcji>{nazwaDnia(d.dzien)}</NaglowekSekcji>
          <ul className="grid gap-2.5">
            {d.punkty.map((p) => (
              <PunktDoEdycji key={p.id} punkt={p} />
            ))}
          </ul>
        </section>
      ))}

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
