"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { komunikat } from "@/lib/zapisy/bledy";

export function Awans({ id, wolneMiejsce }: { id: string; wolneMiejsce: boolean }) {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function awansuj() {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const { error } = await createClient().rpc("awansuj_z_rezerwy", {
      p_registration_id: id,
    });

    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Awans z rezerwy nie przeszedł:", error);
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid justify-items-end gap-1">
      <button
        type="button"
        onClick={() => void awansuj()}
        disabled={czeka || !wolneMiejsce}
        className="min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold
                   text-kosc hover:bg-white/10 disabled:opacity-40
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
      >
        {czeka ? "..." : "Awansuj"}
      </button>
      {blad && <span className="text-xs text-krew-jasna">{blad}</span>}
    </div>
  );
}
