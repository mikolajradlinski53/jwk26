import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import { Odswiezaj } from "../Odswiezaj";
import { Wyzwania, type Gracz, type Wyzwanie } from "./Wyzwania";

/**
 * Wyzwania 1 na 1 (2026-10-25): stawka wyzywającego schodzi od razu, wyzwany
 * przyjmuje albo odrzuca. Po dwie karty, bliżej 21 bierze pulę - losuje baza.
 */
export default async function WyzwaniaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: wyzwania }, { data: gracze }, { data: zetony }] = await Promise.all([
    supabase.rpc("moje_wyzwania"),
    supabase.rpc("gracze_do_wyzwania"),
    supabase.rpc("moje_zetony"),
  ]);
  const z = zetony as { tryb: boolean; saldo: number } | null;

  return (
    <Ekran tytul="Wyzwania 1 na 1" podtytul="Pojedynek kart o żetony">
      <Odswiezaj sekundy={10} />
      {z?.tryb ? (
        <Wyzwania
          ja={user.id}
          saldo={z.saldo}
          gracze={(gracze ?? []) as Gracz[]}
          wyzwania={(wyzwania ?? []) as Wyzwanie[]}
        />
      ) : (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Wyzwania działają, kiedy kasyno gra na żetonach.
        </p>
      )}
      <Wroc href="/app/arcade">Wróć do kasyna</Wroc>
    </Ekran>
  );
}
