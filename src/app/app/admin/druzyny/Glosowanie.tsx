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
  // Dwa niezależne potwierdzenia - obie akcje są nieodwracalne (zamknięcie
  // liczy oddane głosy, odblokowanie kasuje nazwę i motto), jedno dotknięcie
  // nie może ich wykonać od razu.
  const [zamykam, setZamykam] = useState(false);
  const [odblokowuje, setOdblokowuje] = useState(false);
  return (
    <div className="mt-2 grid gap-2">
      <p className="text-xs text-dym">
        {ETAP[team.glosowanie]}
        {team.glosowanie === "trwa" && ` · zagłosowało ${glosow} z ${czlonkow}`}
        {team.nazwa_nadana && " · nazwa nadana"}
      </p>
      {team.glosowanie === "trwa" &&
        (zamykam ? (
          <div className="grid gap-1.5">
            <p className="px-1 text-xs text-dym">Zamknięcie liczy oddane głosy - nie da się go cofnąć.</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="szklo" onClick={() => setZamykam(false)} disabled={czeka}>
                Jeszcze nie
              </Button>
              <Button onClick={() => void wykonaj("zamknij_glosowanie_teraz", { p_team: team.id })} disabled={czeka}>
                {czeka ? "Zamykam..." : "Tak, zamknij"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="szklo" onClick={() => setZamykam(true)} disabled={czeka}>
            Zamknij teraz
          </Button>
        ))}
      {team.nazwa_nadana &&
        (odblokowuje ? (
          <div className="grid gap-1.5">
            <p className="px-1 text-xs text-dym">Nazwa i motto drużyny zostaną usunięte.</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="szklo" onClick={() => setOdblokowuje(false)} disabled={czeka}>
                Jeszcze nie
              </Button>
              <Button onClick={() => void wykonaj("odblokuj_nazwe", { p_team: team.id })} disabled={czeka}>
                {czeka ? "Odblokowuję..." : "Tak, odblokuj"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="szklo" onClick={() => setOdblokowuje(true)} disabled={czeka}>
            Odblokuj nazwę
          </Button>
        ))}
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}
