"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import { adresZdjeciaGossipu, type KategoriaGossipow } from "@/lib/gossipy";

export type Wpis = {
  id: string;
  autor: string;
  na_kogo: string;
  tekst: string;
  zdjecie: string | null;
  ukryte: boolean;
  przejrzane: boolean;
};

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
          Zamknij nominacje
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
          Nominacje i moderacja ({wpisy.length})
        </summary>
        {wpisy.length === 0 && <p className="text-sm text-dym">Brak nominacji.</p>}
        <ul className="grid gap-2">
          {wpisy.map((w) => (
            <li key={w.id} className={`rounded-sm border border-white/10 p-3 ${w.ukryte ? "opacity-50" : ""}`}>
              <p className="flex items-center gap-1.5 text-xs text-dym">
                {/* Nowe - jeszcze nieprzejrzane; to one zapalają licznik w pasku. */}
                {!w.przejrzane && !w.ukryte && (
                  <span aria-label="nowe" className="inline-block size-2 flex-none rounded-full bg-krew" />
                )}
                {w.autor} → {w.na_kogo}
                {w.ukryte && " · ukryte"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-kosc">{w.tekst}</p>
              {w.zdjecie && (
                <a href={adresZdjeciaGossipu(w.zdjecie)} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element -- prywatna trasa z sesją, bez optymalizatora */}
                  <img
                    src={adresZdjeciaGossipu(w.zdjecie)}
                    alt="Zdjęcie z nominacji"
                    loading="lazy"
                    className="size-24 rounded-sm object-cover"
                  />
                </a>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {!w.przejrzane && !w.ukryte && (
                  <button
                    type="button"
                    onClick={() => void wykonaj("oznacz_przejrzane", { p_glos: w.id })}
                    disabled={czeka}
                    className="min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold text-kosc
                               hover:bg-white/10 disabled:opacity-40"
                  >
                    Przejrzane
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void wykonaj("ukryj_uzasadnienie", { p_glos: w.id, p_ukryte: !w.ukryte })}
                  disabled={czeka}
                  className="min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold text-kosc
                             hover:bg-white/10 disabled:opacity-40"
                >
                  {w.ukryte ? "Pokaż" : w.zdjecie ? "Ukryj tekst i zdjęcie" : "Ukryj uzasadnienie"}
                </button>
              </div>
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
