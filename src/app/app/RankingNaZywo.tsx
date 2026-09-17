"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamScore } from "@/types/db";

const RZYMSKIE = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export function RankingNaZywo({ poczatkowe }: { poczatkowe: TeamScore[] }) {
  const [wyniki, setWyniki] = useState(poczatkowe);
  const [podswietlone, setPodswietlone] = useState<Set<string>>(new Set());

  // Poprzednie wyniki trzymamy w ref, nie w stanie: służą wyłącznie do
  // porównania i nie mają powodu wywoływać renderu same z siebie.
  const poprzednie = useRef(
    new Map(poczatkowe.map((w) => [w.team_id, w.score])),
  );

  const odswiez = useCallback(async () => {
    const { data } = await createClient()
      .from("team_scores")
      .select("*")
      .order("score", { ascending: false });
    if (!data) return;

    const nowe = data as TeamScore[];
    const zmienione = new Set(
      nowe
        .filter((n) => poprzednie.current.get(n.team_id) !== n.score)
        .map((n) => n.team_id),
    );

    poprzednie.current = new Map(nowe.map((w) => [w.team_id, w.score]));
    setWyniki(nowe);

    if (zmienione.size > 0) {
      setPodswietlone(zmienione);
      window.setTimeout(() => setPodswietlone(new Set()), 1400);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Subskrybujemy points_ledger, nie team_scores: Supabase nie wysyła zdarzeń
    // z widoków. Zdarzenie niesie wyłącznie sygnał „coś się zmieniło" — sumę po
    // drużynie i tak liczy baza, więc wynik dociągamy zapytaniem.
    // Księga jest tylko do dopisywania, więc INSERT to jedyne możliwe zdarzenie.
    //
    // config.postgres_changes_options.wait: true jest konieczne. Bez tego
    // `subscribe()` zgłasza SUBSCRIBED już w chwili dołączenia do kanału,
    // zanim serwer naprawdę uruchomi subskrypcję postgres_changes na
    // replikacji — insert wykonany tuż po SUBSCRIBED (typowe zaraz po wejściu
    // na ranking) w tym oknie ginie bez żadnego błędu po stronie klienta.
    // Zweryfikowane skryptem: bez `wait: true` zdarzenie nie przychodziło
    // nigdy w ciągu 15 s, z `wait: true` przychodziło w ok. 0,7 s.
    const kanal = supabase
      .channel("ranking-druzyn", {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "points_ledger" },
        () => {
          void odswiez();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [odswiez]);

  return (
    <ol className="grid gap-2.5">
      {wyniki.map((w, i) => {
        const lider = i === 0;
        return (
          <li
            key={w.team_id}
            className={
              "szklo flex items-center gap-3 rounded-md px-3.5 py-3.5 " +
              (lider
                ? "border-krew/55 shadow-[inset_0_1px_0_rgb(255_255_255/0.34),0_0_28px_rgb(200_16_46/0.3)] "
                : "") +
              (podswietlone.has(w.team_id) ? "blysk" : "")
            }
          >
            <span
              className={
                "w-6 flex-none text-center font-tytul text-xl leading-none tabular-nums " +
                (lider ? "text-krew-jasna" : "text-dym")
              }
            >
              {RZYMSKIE[i] ?? i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm font-bold">{w.name}</b>
              <span className="block text-[0.62rem] text-dym">{w.motto}</span>
            </span>
            <span
              className={
                "flex-none font-tytul text-xl leading-none tabular-nums " +
                (lider ? "text-krew-jasna" : "")
              }
            >
              {w.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
