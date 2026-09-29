import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { WyborKapitana } from "./WyborKapitana";
import type { Team, TeamScore, UserScore } from "@/types/db";
import { Wroc } from "@/components/Wroc";

export default async function AdminDruzynyPage() {
  const supabase = await createClient();

  const [{ data: druzyny }, { data: wyniki }, { data: osoby }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_scores").select("*"),
    supabase.from("user_scores").select("*").order("display_name"),
  ]);

  const salda = new Map(
    ((wyniki ?? []) as TeamScore[]).map((w) => [w.team_id, w.score]),
  );
  const czlonkowie = (osoby ?? []) as UserScore[];

  return (
    <Ekran tytul="Drużyny" podtytul="Kapitan kupuje z salda drużyny">
      <ul className="grid gap-2.5">
        {((druzyny ?? []) as Team[]).map((d) => (
          <li key={d.id} className="szklo rounded-md px-3.5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-bold" style={{ color: d.color }}>
                {d.name}
              </span>
              <span className="flex-none font-tytul text-lg leading-none tabular-nums">
                {salda.get(d.id) ?? 0}
              </span>
            </div>
            <WyborKapitana
              teamId={d.id}
              kapitanId={d.captain_id}
              czlonkowie={czlonkowie.filter((c) => c.team_id === d.id)}
            />
          </li>
        ))}
      </ul>

      <p className="mt-5 px-1 text-xs leading-relaxed text-dym">
        Bez kapitana drużyna nic nie kupi. Zmiana działa od razu - poprzedni traci
        prawo zakupu, historia zostaje.
      </p>

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
