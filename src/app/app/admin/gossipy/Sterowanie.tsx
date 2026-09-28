"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import type { KategoriaGossipow } from "@/lib/gossipy";

type Wpis = { id: string; autor: string; na_kogo: string; tekst: string; ukryte: boolean };

/**
 * Zmiana statusu kategorii i moderacja uzasadnień. Ujawnienie wysyła push
 * do wszystkich i jest nieodwracalne, więc ma krok potwierdzenia.
 */
export function Sterowanie({ kategoria, wpisy }: { kategoria: KategoriaGossipow; wpisy: Wpis[] }) {
  const router = useRouter();
  const [pyta, setPyta] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function wykonaj(rpc: string, parametry: Record<string, unknown>) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc(rpc, parametry);
    setCzeka(false);
    wToku.current = false;
    setPyta(false);
    if (error) {
      console.error("Operacja na gossipach nie przeszła:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  const status = (s: string) => wykonaj("zmien_status_kategorii", { p_kategoria: kategoria.id, p_status: s });

  return (
    <div className="grid gap-3">
      {kategoria.status === "otwarta" && (
        <Button variant="szklo" onClick={() => void status("zamknieta")} disabled={czeka}>
          Zamknij głosowanie
        </Button>
      )}
      {kategoria.status === "zamknieta" && !pyta && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="szklo" onClick={() => void status("otwarta")} disabled={czeka}>
            Otwórz ponownie
          </Button>
          <Button onClick={() => setPyta(true)} disabled={czeka}>
            Ujawnij wynik
          </Button>
        </div>
      )}
      {kategoria.status === "zamknieta" && pyta && (
        <div className="grid gap-3">
          <p aria-live="polite" className="text-sm text-kosc">
            Ujawnić wynik? Wszyscy dostaną powiadomienie, a wyniku nie da się już schować.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="szklo" onClick={() => setPyta(false)} disabled={czeka}>
              Zostaw
            </Button>
            <Button onClick={() => void status("ujawniona")} disabled={czeka}>
              Ujawnij
            </Button>
          </div>
        </div>
      )}

      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-xs text-dym">
          Głosy i moderacja ({wpisy.length})
        </summary>
        {wpisy.length === 0 && <p className="text-sm text-dym">Brak głosów.</p>}
        <ul className="grid gap-2">
          {wpisy.map((w) => (
            <li key={w.id} className={`rounded-sm border border-white/10 p-3 ${w.ukryte ? "opacity-50" : ""}`}>
              <p className="text-xs text-dym">
                {w.autor} → {w.na_kogo}
                {w.ukryte && " · ukryte"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-kosc">{w.tekst}</p>
              <button
                type="button"
                onClick={() => void wykonaj("ukryj_uzasadnienie", { p_glos: w.id, p_ukryte: !w.ukryte })}
                disabled={czeka}
                className="mt-2 min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold text-kosc
                           hover:bg-white/10 disabled:opacity-40"
              >
                {w.ukryte ? "Pokaż" : "Ukryj uzasadnienie"}
              </button>
            </li>
          ))}
        </ul>
      </details>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
    </div>
  );
}
