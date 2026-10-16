"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Anulowanie zaplanowanego ogłoszenia - działa do chwili wysyłki. */
export function AnulujPlan({ id, tytul }: { id: number; tytul: string }) {
  const router = useRouter();
  const [czeka, setCzeka] = useState(false);
  const [blad, setBlad] = useState(false);
  const wToku = useRef(false);

  async function anuluj() {
    if (wToku.current || !window.confirm(`Anulować „${tytul}”?`)) return;
    wToku.current = true;
    setCzeka(true);
    const { error } = await createClient().rpc("anuluj_ogloszenie", { p_id: id });
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Anulowanie ogłoszenia nie przeszło:", error);
      setBlad(true);
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void anuluj()}
      disabled={czeka}
      className="min-h-10 shrink-0 rounded-sm px-2 text-xs font-bold text-krew-jasna disabled:opacity-50"
    >
      {czeka ? "…" : blad ? "Już wyszło" : "Anuluj"}
    </button>
  );
}
