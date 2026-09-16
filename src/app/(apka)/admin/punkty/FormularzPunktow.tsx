"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { Team, UserScore } from "@/types/db";

export function FormularzPunktow({
  druzyny,
  osoby,
}: {
  druzyny: Team[];
  osoby: UserScore[];
}) {
  const router = useRouter();
  const [cel, setCel] = useState<string>(druzyny[0] ? `t:${druzyny[0].id}` : "");
  const [delta, setDelta] = useState("");
  const [powod, setPowod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function przyznaj() {
    if (wToku.current) return;
    setBlad(null);
    setUdane(null);

    const liczba = Number.parseInt(delta, 10);
    if (!Number.isFinite(liczba) || liczba === 0) {
      setBlad("Podaj liczbę punktów różną od zera");
      return;
    }
    if (Math.abs(liczba) > 100000) {
      setBlad("To za dużo. Maksymalnie 100 000 punktów naraz.");
      return;
    }
    if (powod.trim().length < 3) {
      setBlad("Uzasadnienie jest wymagane");
      return;
    }

    wToku.current = true;
    setCzeka(true);

    const [rodzaj, id] = cel.split(":");
    const { error } = await createClient().rpc("award_points", {
      p_delta: liczba,
      p_reason: powod.trim(),
      p_user_id: rodzaj === "u" ? id : null,
      p_team_id: rodzaj === "t" ? id : null,
    });

    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Przyznanie punktów nie przeszło:", error);
      setBlad(error.message);
      return;
    }

    setUdane(`Zapisano ${liczba > 0 ? "+" : ""}${liczba}`);
    setDelta("");
    setPowod("");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <label className="block">
        <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
          Komu
        </span>
        <select
          value={cel}
          onChange={(e) => setCel(e.target.value)}
          className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none
                     focus-visible:border-krew"
        >
          <optgroup label="Drużyny">
            {druzyny.map((d) => (
              <option key={d.id} value={`t:${d.id}`}>
                {d.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Osoby">
            {osoby.map((o) => (
              <option key={o.user_id} value={`u:${o.user_id}`}>
                {o.display_name ?? "bez nazwy"} — {o.team_name ?? "bez drużyny"}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <Field
        label="Ile punktów"
        type="text"
        inputMode="numeric"
        placeholder="np. 40 albo -25"
        value={delta}
        onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))}
      />

      <Field
        label="Za co"
        placeholder="wygrana konkurencja przy ognisku"
        value={powod}
        onChange={(e) => setPowod(e.target.value)}
        error={blad}
      />

      {udane && <p className="text-sm text-krew-jasna">{udane}</p>}

      <Button onClick={przyznaj} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Wpisz do księgi"}
      </Button>

      <p className="text-center text-xs leading-relaxed text-dym">
        Wpis trafia do księgi na zawsze. Nie da się go zmienić ani usunąć —
        pomyłkę prostuje się wpisem przeciwnym.
      </p>
    </div>
  );
}
