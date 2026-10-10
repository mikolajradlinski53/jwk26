"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { Team } from "@/types/db";

const ETAP: Record<Team["glosowanie"], string> = {
  nie_rozpoczete: "głosowanie nierozpoczęte",
  trwa: "głosowanie trwa",
  zakonczone: "głosowanie zakończone",
};

function useAkcja() {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);
  async function wykonaj(rpc: string, args?: Record<string, unknown>) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc(rpc, args);
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${rpc} nie przeszło:`, error);
      setBlad(error.message);
      return;
    }
    router.refresh();
  }
  return { blad, czeka, wykonaj };
}

/** Start wyboru kapitanów - dla wszystkich drużyn naraz, gdy składy są gotowe. */
export function StartGlosowania() {
  const { blad, czeka, wykonaj } = useAkcja();
  const [pewny, setPewny] = useState(false);
  return (
    <div className="mb-5 grid gap-2">
      {pewny ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="szklo" onClick={() => setPewny(false)} disabled={czeka}>
            Jeszcze nie
          </Button>
          <Button onClick={() => void wykonaj("rozpocznij_glosowanie")} disabled={czeka}>
            {czeka ? "Startuję..." : "Tak, start"}
          </Button>
        </div>
      ) : (
        <Button onClick={() => setPewny(true)}>Rozpocznij wybór kapitanów</Button>
      )}
      <p className="px-1 text-xs text-dym">
        Startuj, gdy składy są gotowe - głosowanie zamyka się samo, gdy zagłosuje cała drużyna.
      </p>
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}

export function AkcjeDruzyny({ team, glosow, czlonkow }: { team: Team; glosow: number; czlonkow: number }) {
  const { blad, czeka, wykonaj } = useAkcja();
  return (
    <div className="mt-2 grid gap-2">
      <p className="text-xs text-dym">
        {ETAP[team.glosowanie]}
        {team.glosowanie === "trwa" && ` · zagłosowało ${glosow} z ${czlonkow}`}
        {team.nazwa_nadana && " · nazwa nadana"}
      </p>
      <div className="flex flex-wrap gap-2">
        {team.glosowanie === "trwa" && (
          <Button variant="szklo" onClick={() => void wykonaj("zamknij_glosowanie_teraz", { p_team: team.id })} disabled={czeka}>
            Zamknij teraz
          </Button>
        )}
        {team.nazwa_nadana && (
          <Button variant="szklo" onClick={() => void wykonaj("odblokuj_nazwe", { p_team: team.id })} disabled={czeka}>
            Odblokuj nazwę
          </Button>
        )}
      </div>
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}
