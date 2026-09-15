import { createClient } from "@/lib/supabase/server";
import { RitualFrame } from "@/components/RitualFrame";
import { Button } from "@/components/ui/Button";
import type { TeamScore } from "@/types/db";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_scores")
    .select("*")
    .order("score", { ascending: false });

  const wyniki = (data ?? []) as TeamScore[];

  return (
    <RitualFrame title="Ranking Sekt">
      <ol className="grid gap-2">
        {wyniki.map((w, i) => (
          <li
            key={w.team_id}
            className="flex items-center justify-between border-l-4 bg-ash/60 px-4 py-3"
            style={{ borderLeftColor: w.color }}
          >
            <span className="font-display tracking-wider">
              <span className="text-smoke">#{i + 1}</span> {w.name}
            </span>
            <strong className="text-candle">{w.score}</strong>
          </li>
        ))}
      </ol>

      <form action="/auth/signout" method="post" className="mt-10">
        <Button variant="ghost" type="submit" className="w-full">
          Opuść sektę
        </Button>
      </form>
    </RitualFrame>
  );
}
