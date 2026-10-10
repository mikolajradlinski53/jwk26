import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { WyborKapitana } from "./WyborKapitana";
import { StartGlosowania, AkcjeDruzyny } from "./Glosowanie";
import type { Team, TeamScore, UserScore } from "@/types/db";
import { Wroc } from "@/components/Wroc";

export default async function AdminDruzynyPage() {
  const supabase = await createClient();

  const [{ data: druzyny }, { data: wyniki }, { data: osoby }, { data: postepy }] = await Promise.all([
    supabase.from("teams").select("*").order("numer", { nullsFirst: false }),
    supabase.from("team_scores").select("*"),
    supabase.from("user_scores").select("*").order("display_name"),
    supabase.rpc("postep_glosowania"),
  ]);

  const salda = new Map(
    ((wyniki ?? []) as TeamScore[]).map((w) => [w.team_id, w.score]),
  );
  const czlonkowie = (osoby ?? []) as UserScore[];
  const postep = new Map(
    (postepy as { team_id: string; glosow: number; czlonkow: number }[] | null ?? []).map(
      (p) => [p.team_id, { glosow: p.glosow, czlonkow: p.czlonkow }],
    ),
  );
  const zespoly = (druzyny ?? []) as Team[];

  return (
    <Ekran tytul="Drużyny" podtytul="Kapitan kupuje z salda drużyny">
      {zespoly.every((d) => d.glosowanie === "nie_rozpoczete") && <StartGlosowania />}
      <ul className="grid gap-2.5">
        {zespoly.map((d) => (
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
            <AkcjeDruzyny
              team={d}
              glosow={postep.get(d.id)?.glosow ?? 0}
              czlonkow={postep.get(d.id)?.czlonkow ?? 0}
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
