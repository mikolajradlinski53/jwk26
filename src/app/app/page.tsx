import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { RankingNaZywo, type Czlonek } from "./RankingNaZywo";
import type { TeamScore } from "@/types/db";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bramka nie wpuści tu niezalogowanego, ale token może wygasnąć między jej
  // sprawdzeniem a tym renderem. Lepsze przekierowanie niż 500.
  if (!user) redirect("/wejscie");

  const [{ data }, { data: czlonkowie }] = await Promise.all([
    supabase.from("team_scores").select("*").order("score", { ascending: false }),
    // Skład drużyn do rozwinięcia wiersza - widok liczy punkty każdej osoby.
    supabase
      .from("user_scores")
      .select("user_id, display_name, team_id, score")
      .not("team_id", "is", null)
      .order("score", { ascending: false }),
  ]);

  return (
    <Ekran tytul="Ranking Sekt" podtytul="Punkty ruszą razem z bingo">
      {/* Odczyt przy wejściu zostaje niezależnie od subskrypcji - przy słabym
          zasięgu websocket może nie dojść, a ranking musi się pokazać. */}
      <RankingNaZywo
        poczatkowe={(data ?? []) as TeamScore[]}
        czlonkowiePoczatkowi={(czlonkowie ?? []) as Czlonek[]}
        mojeId={user.id}
      />
    </Ekran>
  );
}
