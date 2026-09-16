"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { Team } from "@/types/db";

export function PrzyciskiDecyzji({
  zgloszenieId,
  druzyny,
}: {
  zgloszenieId: string;
  druzyny: Team[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(druzyny[0]?.id ?? "");
  const [notatka, setNotatka] = useState("");
  const [czeka, setCzeka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  // Ten sam rygiel co w formularzu rejestracyjnym: `czeka` odczytane
  // w domknięciu bywa nieaktualne, a chodzi o okno krótsze niż jeden render.
  const wToku = useRef(false);

  async function rozpatrz(akceptuj: boolean) {
    if (wToku.current) return;
    wToku.current = true;
    setBlad(null);
    setCzeka(true);

    const { error } = await createClient().rpc("review_registration", {
      p_registration_id: zgloszenieId,
      p_approve: akceptuj,
      p_team_id: akceptuj ? teamId : null,
      p_note: notatka.trim() || null,
    });

    if (error) {
      console.error("Rozpatrzenie zgłoszenia nie przeszło:", error);
      setBlad(error.message);
      setCzeka(false);
      wToku.current = false;
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 grid gap-3">
      <label className="block">
        <span className="mb-1.5 block font-tytul text-xs uppercase tracking-widest text-dym">
          Drużyna
        </span>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="szklo min-h-11 w-full rounded-sm px-3
                     text-kosc outline-none focus-visible:border-krew"
        >
          {druzyny.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <input
        value={notatka}
        onChange={(e) => setNotatka(e.target.value)}
        placeholder="Notatka (widoczna przy odrzuceniu)"
        className="szklo min-h-11 w-full rounded-sm px-3
                   text-kosc outline-none placeholder:text-dym/70
                   focus-visible:border-krew"
      />

      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => rozpatrz(true)} disabled={czeka || !teamId}>
          Przyjmij
        </Button>
        <Button variant="szklo" onClick={() => rozpatrz(false)} disabled={czeka}>
          Odrzuć
        </Button>
      </div>
    </div>
  );
}
