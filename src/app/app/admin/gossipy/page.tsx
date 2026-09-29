import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { NAZWY_STATUSU, type KategoriaGossipow } from "@/lib/gossipy";
import { NowaKategoria } from "./NowaKategoria";
import { Sterowanie } from "./Sterowanie";
import { Wroc } from "@/components/Wroc";

export default async function AdminGossipyPage() {
  const supabase = await createClient();

  const [{ data: kategorieRaw, error }, { data: uczestnicyRaw }] = await Promise.all([
    supabase.rpc("gossipy"),
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("status", "approved")
      .order("display_name"),
  ]);

  const kategorie = (kategorieRaw ?? []) as KategoriaGossipow[];
  const uczestnicy = (uczestnicyRaw ?? []).map((u) => ({
    id: u.id as string,
    nazwa: (u.display_name as string | null) ?? (u.email as string),
  }));

  // Moderacja per kategoria — kilka kategorii na wyjazd, więc osobne zapytania
  // nie bolą, a funkcja i tak sprawdza rolę admina sama.
  const moderacja = await Promise.all(
    kategorie.map(async (k) => {
      const { data } = await supabase.rpc("moderacja_gossipow", { p_kategoria: k.id });
      return [k.id, (data ?? []) as { id: string; autor: string; na_kogo: string; tekst: string; ukryte: boolean }[]] as const;
    }),
  );
  const wpisy = new Map(moderacja);

  return (
    <Ekran tytul="Gossipy" podtytul="Kategorie, głosy i moderacja">
      <NowaKategoria uczestnicy={uczestnicy} />

      {error && (
        <p className="szklo mt-5 rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać kategorii. Odśwież stronę.
        </p>
      )}

      <ul className="mt-6 grid gap-4">
        {kategorie.map((k) => (
          <li key={k.id} className="szklo grid gap-3 rounded-md px-4 py-4">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
                {NAZWY_STATUSU[k.status]}
              </p>
              <h2 className="mt-1 text-base font-bold text-kosc">{k.tytul}</h2>
              <p className="mt-1 text-xs text-dym">
                Nominowani: {k.nominowani.map((n) => n.nazwa).join(", ")}
              </p>
              {k.zwyciezcy && (
                <p className="mt-1 text-sm text-krew-jasna">
                  Wygrywa: {k.zwyciezcy.map((z) => z.nazwa).join(" i ")}
                </p>
              )}
            </div>
            <Sterowanie kategoria={k} wpisy={wpisy.get(k.id) ?? []} />
          </li>
        ))}
      </ul>

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
