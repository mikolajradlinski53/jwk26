import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { RankingNaZywo } from "./RankingNaZywo";
import type { TeamScore } from "@/types/db";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bramka nie wpuści tu niezalogowanego, ale token może wygasnąć między jej
  // sprawdzeniem a tym renderem. Lepsze przekierowanie niż 500.
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("team_scores")
    .select("*")
    .order("score", { ascending: false });

  return (
    <Ekran tytul="Ranking Sekt" podtytul="Punkty ruszą razem z bingo">
      {/* Odczyt przy wejściu zostaje niezależnie od subskrypcji — przy słabym
          zasięgu websocket może nie dojść, a ranking musi się pokazać. */}
      <RankingNaZywo poczatkowe={(data ?? []) as TeamScore[]} />
    </Ekran>
  );
}
