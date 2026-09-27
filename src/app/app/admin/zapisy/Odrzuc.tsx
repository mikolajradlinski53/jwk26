"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { komunikat } from "@/lib/zapisy/bledy";

export function Odrzuc({
  id,
  kto,
}: {
  id: string;
  /** Imię i nazwisko z listy — trafia do aria-label, bo samo „Odrzuć”
   * czytnikowi ekranu nie mówi, kogo dotyczy przycisk w liście wielu osób. */
  kto: string;
}) {
  const router = useRouter();
  const [otwarte, setOtwarte] = useState(false);
  const [powod, setPowod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function odrzuc() {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const { error } = await createClient().rpc("review_registration", {
      p_registration_id: id,
      p_approve: false,
      p_note: powod.trim() || null,
    });

    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Odrzucenie z rezerwy nie przeszło:", error);
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  if (!otwarte) {
    return (
      <button
        type="button"
        onClick={() => setOtwarte(true)}
        aria-label={kto ? `Odrzuć zgłoszenie ${kto}` : "Odrzuć zgłoszenie"}
        className="min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold
                   text-dym hover:bg-white/10
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
      >
        Odrzuć
      </button>
    );
  }

  return (
    <div className="grid w-full gap-2 sm:w-56">
      <label className="grid gap-1 text-xs text-dym">
        Powód (zobaczy go uczestnik)
        <input
          type="text"
          value={powod}
          onChange={(e) => setPowod(e.target.value)}
          aria-label={kto ? `Powód odrzucenia — ${kto}` : "Powód odrzucenia"}
          className="min-h-11 rounded-md border border-white/20 bg-transparent px-3 text-sm text-kosc
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setOtwarte(false);
            setPowod("");
            setBlad(null);
          }}
          disabled={czeka}
          className="min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold
                     text-dym hover:bg-white/10 disabled:opacity-40"
        >
          Zostaw
        </button>
        <button
          type="button"
          onClick={() => void odrzuc()}
          disabled={czeka}
          aria-busy={czeka}
          aria-label={kto ? `Potwierdź odrzucenie zgłoszenia ${kto}` : "Potwierdź odrzucenie zgłoszenia"}
          className="min-h-11 rounded-full border border-krew/50 px-4 text-xs font-bold
                     text-krew-jasna hover:bg-white/10 disabled:opacity-40
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
        >
          {czeka ? "..." : "Odrzuć zgłoszenie"}
        </button>
      </div>
      {blad && (
        <span role="alert" className="text-xs text-krew-jasna">
          {blad}
        </span>
      )}
    </div>
  );
}
