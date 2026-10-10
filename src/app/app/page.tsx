import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { RankingNaZywo, type Czlonek } from "./RankingNaZywo";
import { KartaDruzyny } from "./KartaDruzyny";
import type { StanGlosowania } from "@/lib/druzyna";
import type { TeamScore } from "@/types/db";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bramka nie wpuści tu niezalogowanego, ale token może wygasnąć między jej
  // sprawdzeniem a tym renderem. Lepsze przekierowanie niż 500.
  if (!user) redirect("/wejscie");

  const [{ data }, { data: czlonkowie }, { data: stan }, { data: druzyny }] = await Promise.all([
    supabase.from("team_scores").select("*").order("score", { ascending: false }),
    // Skład drużyn do rozwinięcia wiersza - widok liczy punkty każdej osoby.
    supabase
      .from("user_scores")
      .select("user_id, display_name, team_id, score")
      .not("team_id", "is", null)
      .order("display_name"),
    supabase.rpc("stan_glosowania"),
    supabase.from("teams").select("id, captain_id"),
  ]);
  const stanGlosowania = stan as StanGlosowania | null;
  const kapitanowie = Object.fromEntries(
    ((druzyny ?? []) as { id: string; captain_id: string | null }[])
      .filter((d) => d.captain_id)
      .map((d) => [d.id, d.captain_id as string]),
  );
  const sklad = ((czlonkowie ?? []) as Czlonek[]).filter((c) => c.team_id === stanGlosowania?.team_id);

  return (
    <Ekran tytul="Ranking Sekt" podtytul="Punkty ruszą razem z bingo">
      {/* Odczyt przy wejściu zostaje niezależnie od subskrypcji - przy słabym
          zasięgu websocket może nie dojść, a ranking musi się pokazać. */}
      {stanGlosowania && <KartaDruzyny stan={stanGlosowania} sklad={sklad} mojeId={user.id} />}
      <RankingNaZywo
        poczatkowe={(data ?? []) as TeamScore[]}
        czlonkowiePoczatkowi={(czlonkowie ?? []) as Czlonek[]}
        kapitanowie={kapitanowie}
        mojeId={user.id}
      />
    </Ekran>
  );
}
