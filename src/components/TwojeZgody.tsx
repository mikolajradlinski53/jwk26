"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import type { StanZgod } from "@/lib/zapisy/stanZgod";

type Co = "zdrowie" | "wizerunek" | "sms";

const OPIS: Record<Co, { stan: string; akcja: string; pytanie: string; funkcja: string }> = {
  zdrowie: {
    stan: "Masz zapisane informacje o diecie, alergiach albo lekach.",
    akcja: "Usuń moje dane zdrowotne",
    pytanie: "Usunąć je? Organizator i ośrodek przestaną je znać. Kontakt ICE zostaje.",
    funkcja: "wycofaj_zgode_zdrowie",
  },
  wizerunek: {
    stan: "Twoja zgoda na publikację wizerunku jest aktywna.",
    akcja: "Wycofaj zgodę na wizerunek",
    pytanie: "Wycofać? Nowych zdjęć z Tobą nie opublikujemy; już wydanych nie cofniemy.",
    funkcja: "wycofaj_zgode_wizerunek",
  },
  sms: {
    stan: "Zgadzasz się na SMS-y z komunikatami organizacyjnymi.",
    akcja: "Wycofaj zgodę na SMS-y",
    pytanie: "Wycofać? Komunikaty zobaczysz już tylko w apce.",
    funkcja: "wycofaj_zgode_sms",
  },
};

/**
 * Wycofanie zgody jednym przyciskiem plus potwierdzenie (art. 7 ust. 3 RODO:
 * równie łatwo jak wyrażenie). Potwierdzenie w miejscu, nie `confirm()` -
 * okna dialogowe w apce z ekranu głównego na iOS bywają zawodne.
 */
export function TwojeZgody({ maDaneZdrowotne, zgodaWizerunek, zgodaSms }: StanZgod) {
  const router = useRouter();
  const [pyta, setPyta] = useState<Co | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function wycofaj(co: Co) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const { error } = await createClient().rpc(OPIS[co].funkcja);

    setCzeka(false);
    wToku.current = false;
    setPyta(null);

    if (error) {
      console.error("Wycofanie zgody nie przeszło:", error);
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  const aktywne: Co[] = [
    ...(maDaneZdrowotne ? (["zdrowie"] as const) : []),
    ...(zgodaWizerunek ? (["wizerunek"] as const) : []),
    ...(zgodaSms ? (["sms"] as const) : []),
  ];

  return (
    <section className="mt-8 grid gap-2.5">
      <h2 className="px-1 text-xs uppercase tracking-[0.14em] text-dym">Twoje zgody</h2>

      {aktywne.length === 0 && (
        <p className="px-1 text-xs leading-relaxed text-dym">
          Nie masz zapisanych danych zdrowotnych ani aktywnych zgód do wycofania.
        </p>
      )}

      {aktywne.map((co) => (
        <div key={co} className="szklo grid gap-3 rounded-md px-4 py-3.5">
          <p className="text-sm text-dym">{OPIS[co].stan}</p>
          {pyta === co ? (
            <>
              <p className="text-sm text-kosc" aria-live="polite">
                {OPIS[co].pytanie}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="szklo" onClick={() => setPyta(null)} disabled={czeka}>
                  Zostaw
                </Button>
                <Button onClick={() => void wycofaj(co)} disabled={czeka}>
                  {czeka ? "Usuwam..." : "Tak"}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="szklo" onClick={() => setPyta(co)} disabled={czeka}>
              {OPIS[co].akcja}
            </Button>
          )}
        </div>
      ))}

      {blad && (
        <p role="alert" className="px-1 text-sm text-krew-jasna">
          {blad}
        </p>
      )}
    </section>
  );
}
