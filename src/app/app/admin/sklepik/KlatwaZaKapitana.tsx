"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikatLicytacji } from "@/lib/licytacje";
import type { Team } from "@/types/db";

/** Wygrana Klątwa czeka na ofiarę - admin rzuca ją w imieniu kapitana zwycięzcy. */
export function KlatwaZaKapitana({ orderId, druzyny }: { orderId: string; druzyny: Team[] }) {
  const router = useRouter();
  const [cel, setCel] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function rzuc() {
    if (wToku.current) return;
    if (!cel) return setBlad("Wybierz drużynę.");
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc("rzuc_klatwe", { p_order: orderId, p_target: cel });
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Klątwa za kapitana nie przeszła:", error);
      setBlad(komunikatLicytacji(error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2.5 grid gap-2">
      <select
        value={cel}
        onChange={(e) => setCel(e.target.value)}
        className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none focus-visible:border-krew"
      >
        <option value="">Ofiara</option>
        {druzyny.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
      <Button onClick={() => void rzuc()} disabled={czeka}>
        {czeka ? "Rzucam..." : "Rzuć w imieniu kapitana"}
      </Button>
    </div>
  );
}
