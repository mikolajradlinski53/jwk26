"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

const POLE = "szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none focus-visible:border-krew";

/** Zmiana godziny zamknięcia i anulowanie trwającej licytacji (bez zwycięzcy, blokady znikają). */
export function ObslugaLicytacji({ id, nazwa }: { id: string; nazwa: string }) {
  const router = useRouter();
  const [koniec, setKoniec] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function zmien(zmiana: Record<string, unknown>, opis: string) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().from("licytacje").update(zmiana).eq("id", id).eq("status", "trwa");
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${opis} nie przeszło:`, error);
      setBlad(`${opis} się nie udało. Zamknięcie musi być po otwarciu.`);
      return;
    }
    setKoniec("");
    router.refresh();
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex gap-2">
        <input type="datetime-local" value={koniec} onChange={(e) => setKoniec(e.target.value)} className={POLE} aria-label="Nowe zamknięcie" />
        <Button
          variant="szklo"
          className="flex-none px-4"
          disabled={czeka || !koniec}
          onClick={() => {
            const d = new Date(koniec);
            if (!Number.isNaN(d.getTime())) void zmien({ koniec: d.toISOString() }, "Zmiana zamknięcia");
          }}
        >
          Zmień
        </Button>
      </div>
      <Button
        variant="cichy"
        disabled={czeka}
        onClick={() => {
          if (window.confirm(`Anulować licytację „${nazwa}”? Nikt nie wygra, oferty przepadną.`)) {
            void zmien({ status: "anulowana" }, "Anulowanie");
          }
        }}
      >
        Anuluj licytację
      </Button>
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}
