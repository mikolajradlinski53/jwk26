"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { zdarzenie } from "@/lib/zdarzenia";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import { SymbolBebna, NAZWY_SYMBOLI } from "./Symbole";
import type { WynikSpinu } from "@/types/db";

export function Bebny({
  stawka,
  obrotPoczatkowy,
  limit,
  koniec,
  zetony = false,
}: {
  stawka: number;
  obrotPoczatkowy: number;
  limit: number;
  /** „o 12:00” / „o północy” - kiedy rusza nowa pula. */
  koniec: string;
  /** Kasyno po gali: gra na żetonach, bez okien puli. */
  zetony?: boolean;
}) {
  const router = useRouter();
  const [wynik, setWynik] = useState<WynikSpinu | null>(null);
  const [obrot, setObrot] = useState(obrotPoczatkowy);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  const zostalo = Math.max(0, Math.floor((limit - obrot) / stawka));

  async function zakrec() {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const { data, error } = await createClient().rpc("zakrec_slotami");
    if (!error) zdarzenie("gra", { gra: "sloty" });

    // Odblokowanie przed sprawdzeniem błędu, nie po. Wyjście z funkcji przy
    // zostawionym `wToku` zablokowałoby automat do przeładowania strony - a
    // w trybie aplikacji na iOS przeładowania może nie być.
    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Spin nie przeszedł:", error);
      setBlad(komunikat(error));
      router.refresh();
      return;
    }

    const w = data as WynikSpinu;
    setWynik(w);
    setObrot(w.obrot);
    // Saldo liczy serwer, więc po każdym spinie odświeżamy stronę.
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div
        className="szklo grid grid-cols-3 gap-2 rounded-md px-3 py-6"
        role="status"
        aria-live="polite"
        aria-label={
          wynik
            ? `Wypadło: ${wynik.bebny.map((s) => NAZWY_SYMBOLI[s] ?? s).join(", ")}`
            : "Bębny nieruszone"
        }
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={
              "beben grid place-items-center rounded-sm py-4 " +
              (wynik && wynik.wyplata > 0 ? "text-krew-jasna" : "text-kosc")
            }
          >
            <SymbolBebna symbol={wynik?.bebny[i] ?? null} />
          </div>
        ))}
      </div>

      {wynik && (
        <p
          className={
            "text-center text-sm " +
            (wynik.netto > 0 ? "text-krew-jasna" : "text-dym")
          }
        >
          {wynik.wyplata === 0
            ? `Nic. −${stawka}`
            : wynik.netto === 0
              ? "Zwrot stawki"
              : `Wypłata ${wynik.wyplata}. Netto +${wynik.netto}`}
        </p>
      )}

      {blad && <p className="text-center text-sm text-krew-jasna">{blad}</p>}

      <Button onClick={() => void zakrec()} disabled={czeka || zostalo === 0}>
        {czeka
          ? "Kręcę..."
          : zostalo === 0
            ? zetony
              ? "Brak żetonów"
              : "Pula wyczerpana"
            : `Zakręć - ${stawka} ${zetony ? "żetonów" : "pkt"}`}
      </Button>

      {zetony ? (
        <p className="text-center text-xs leading-relaxed text-dym">
          {zostalo === 0
            ? "Weź dokładkę na górze ekranu."
            : `Starczy na ${zostalo} ${zostalo === 1 ? "spin" : "spinów"}.`}{" "}
          Każdy spin dosypuje do jackpotu.
        </p>
      ) : (
        <p className="text-center text-xs leading-relaxed text-dym">
          {zostalo === 0
            ? `Nowa pula ${koniec}.`
            : `Zostało ${zostalo} ${zostalo === 1 ? "spin" : "spinów"} do nowej puli (${koniec}).`}{" "}
          Wygrane i przegrane liczą się do wyniku drużyny.
        </p>
      )}
    </div>
  );
}
