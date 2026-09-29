"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SymbolBebna, NAZWY_SYMBOLI } from "./Symbole";
import type { WynikSpinu } from "@/types/db";

export function Bebny({
  saldo,
  stawka,
  obrotPoczatkowy,
  limit,
}: {
  saldo: number;
  stawka: number;
  obrotPoczatkowy: number;
  limit: number;
}) {
  const router = useRouter();
  const [wynik, setWynik] = useState<WynikSpinu | null>(null);
  const [obrot, setObrot] = useState(obrotPoczatkowy);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  const zostalo = Math.max(0, Math.floor((limit - obrot) / stawka));
  const nieStac = saldo < stawka;

  async function zakrec() {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const { data, error } = await createClient().rpc("zakrec_slotami");

    // Odblokowanie przed sprawdzeniem błędu, nie po. Wyjście z funkcji przy
    // zostawionym `wToku` zablokowałoby automat do przeładowania strony - a
    // w trybie aplikacji na iOS przeładowania może nie być.
    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Spin nie przeszedł:", error);
      setBlad(error.message);
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

      <Button onClick={() => void zakrec()} disabled={czeka || nieStac || zostalo === 0}>
        {czeka
          ? "Kręcę..."
          : nieStac
            ? "Za mało punktów"
            : zostalo === 0
              ? "Limit wyczerpany"
              : `Zakręć - ${stawka} pkt`}
      </Button>

      <p className="text-center text-xs leading-relaxed text-dym">
        Zostało {zostalo} {zostalo === 1 ? "spin" : "spinów"} w ciągu doby. Stawka
        i wypłaty idą na twoje saldo, a ono sumuje się do drużyny.
      </p>
    </div>
  );
}
