"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamScore } from "@/types/db";

const RZYMSKIE = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export type Czlonek = { user_id: string; display_name: string | null; team_id: string; score: number };

export function RankingNaZywo({
  poczatkowe,
  czlonkowiePoczatkowi,
  kapitanowie,
  mojeId,
}: {
  poczatkowe: TeamScore[];
  czlonkowiePoczatkowi: Czlonek[];
  kapitanowie: Record<string, string>;
  mojeId: string;
}) {
  const [wyniki, setWyniki] = useState(poczatkowe);
  const [czlonkowie, setCzlonkowie] = useState(czlonkowiePoczatkowi);
  const [podswietlone, setPodswietlone] = useState<Set<string>>(new Set());
  const [rozwiniete, setRozwiniete] = useState<Set<string>>(new Set());

  // Poprzednie wyniki trzymamy w ref, nie w stanie: służą wyłącznie do
  // porównania i nie mają powodu wywoływać renderu same z siebie.
  const poprzednie = useRef(
    new Map(poczatkowe.map((w) => [w.team_id, w.score])),
  );

  const odswiez = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: osoby }] = await Promise.all([
      supabase.from("team_scores").select("*").order("score", { ascending: false }),
      supabase
        .from("user_scores")
        .select("user_id, display_name, team_id, score")
        .not("team_id", "is", null)
        .order("display_name"),
    ]);
    if (osoby) setCzlonkowie(osoby as Czlonek[]);
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
    // z widoków. Zdarzenie niesie wyłącznie sygnał „coś się zmieniło" - sumę po
    // drużynie i tak liczy baza, więc wynik dociągamy zapytaniem.
    // Księga jest tylko do dopisywania, więc INSERT to jedyne możliwe zdarzenie.
    //
    // config.postgres_changes_options.wait: true jest konieczne. Bez tego
    // `subscribe()` zgłasza SUBSCRIBED już w chwili dołączenia do kanału,
    // zanim serwer naprawdę uruchomi subskrypcję postgres_changes na
    // replikacji - insert wykonany tuż po SUBSCRIBED (typowe zaraz po wejściu
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

  function przelacz(id: string) {
    setRozwiniete((stare) => {
      const nowe = new Set(stare);
      if (nowe.has(id)) nowe.delete(id);
      else nowe.add(id);
      return nowe;
    });
  }

  return (
    <ol className="grid gap-2.5">
      {wyniki.map((w, i) => {
        const lider = i === 0;
        const otwarta = rozwiniete.has(w.team_id);
        const sklad = czlonkowie.filter((c) => c.team_id === w.team_id);
        const idListy = `sklad-${w.team_id}`;
        // Nazwa/motto czytane na bieżąco z propsów (świeże po router.refresh(),
        // np. zaraz po nadaniu nazwy przez kapitana), nie ze stanu `wyniki` -
        // ten odświeża tylko subskrypcja na points_ledger, która nazwy nie
        // dotyczy. Kolejność i wynik zostają ze stanu, bo to on napędza
        // podświetlenie zmiany punktów.
        const zPropsow = poczatkowe.find((p) => p.team_id === w.team_id);
        const nazwa = zPropsow?.name ?? w.name;
        const motto = zPropsow?.motto ?? w.motto;
        return (
          <li
            key={w.team_id}
            className={
              "szklo overflow-hidden rounded-md " +
              (lider
                ? "border-krew/55 shadow-[inset_0_1px_0_rgb(255_255_255/0.34),0_0_28px_rgb(200_16_46/0.3)] "
                : "") +
              (podswietlone.has(w.team_id) ? "blysk" : "")
            }
          >
            {/* Dotknięcie sekty rozwija jej skład (zgłoszenie Mikołaja). */}
            <button
              type="button"
              onClick={() => przelacz(w.team_id)}
              aria-expanded={otwarta}
              aria-controls={idListy}
              className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left
                         focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-krew"
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
                <b className="block text-sm font-bold">{nazwa}</b>
                <span className="block text-[0.62rem] text-dym">{motto}</span>
              </span>
              <span
                className={
                  "flex-none font-tytul text-xl leading-none tabular-nums " +
                  (lider ? "text-krew-jasna" : "")
                }
              >
                {w.score}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={"size-4 flex-none text-dym transition-transform duration-300 " + (otwarta ? "rotate-180" : "")}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* grid-rows 0fr → 1fr: płynne rozwinięcie bez mierzenia wysokości. */}
            <div
              id={idListy}
              className={
                "grid transition-[grid-template-rows] duration-300 ease-out " +
                (otwarta ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
              }
            >
              <div className="min-h-0 overflow-hidden">
                {sklad.length === 0 ? (
                  <p className="px-4 pb-3.5 text-xs text-dym">W tej sekcie nikogo jeszcze nie ma.</p>
                ) : (
                  // Punkty osób celowo niewidoczne (decyzja 2026-10-08) - każdy widzi swoje w kasynie i w „Więcej”.
                  <ol className="grid gap-0.5 border-t border-white/10 px-3.5 pb-3 pt-2">
                    {sklad.map((c, j) => (
                      <li
                        key={c.user_id}
                        className={
                          "flex items-baseline gap-3 rounded-sm px-1.5 py-1.5 text-sm " +
                          (c.user_id === mojeId ? "bg-white/8 font-bold text-kosc" : "text-popiol")
                        }
                      >
                        <span className="w-5 flex-none text-right text-xs tabular-nums text-dym">{j + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">
                          {c.display_name ?? "Uczestnik"}
                          {c.user_id === mojeId && <span className="ml-1.5 text-xs font-normal text-dym">(Ty)</span>}
                          {kapitanowie[w.team_id] === c.user_id && (
                            <span className="ml-1.5 text-xs text-krew-jasna" aria-label="kapitan">♛</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
