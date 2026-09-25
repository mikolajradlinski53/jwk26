"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserScore } from "@/types/db";

export function WyborKapitana({
  teamId,
  kapitanId,
  czlonkowie,
}: {
  teamId: string;
  kapitanId: string | null;
  czlonkowie: UserScore[];
}) {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const wToku = useRef(false);

  async function ustaw(wartosc: string) {
    if (wToku.current) return;
    wToku.current = true;
    setBlad(null);

    // Bez nowej funkcji w bazie: polityka teams_admin_write istnieje od pierwszej
    // migracji i przepuszcza adminowi UPDATE na drużynach.
    const { error } = await createClient()
      .from("teams")
      .update({ captain_id: wartosc === "" ? null : wartosc })
      .eq("id", teamId);

    wToku.current = false;

    if (error) {
      console.error("Zmiana kapitana nie przeszła:", error);
      setBlad(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <label className="mt-2 block">
      <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
        Kapitan
      </span>
      <select
        value={kapitanId ?? ""}
        onChange={(e) => void ustaw(e.target.value)}
        className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc
                   outline-none focus-visible:border-krew"
      >
        <option value="">— nikt —</option>
        {czlonkowie.map((c) => (
          <option key={c.user_id} value={c.user_id}>
            {c.display_name ?? "bez nazwy"}
          </option>
        ))}
      </select>
      {blad && <span className="mt-1.5 block text-sm text-krew-jasna">{blad}</span>}
    </label>
  );
}
