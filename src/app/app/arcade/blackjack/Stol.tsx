"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";

export type RekaBj = {
  id: string;
  stawka: number;
  status: "open" | "settled";
  gracz: string[];
  krupier: string[];
  punkty_gracza: number;
  punkty_krupiera: number | null;
  wynik: "wygrana" | "przegrana" | "remis" | "blackjack" | "fura" | null;
  wyplata: number | null;
  mozna_podwoic: boolean;
};

const STAWKI = [10, 20, 50] as const;

const WYNIK: Record<NonNullable<RekaBj["wynik"]>, string> = {
  blackjack: "Blackjack!",
  wygrana: "Wygrana",
  remis: "Remis — stawka wraca",
  przegrana: "Przegrana",
  fura: "Fura — ponad 21",
};

const KOLOR: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

function Karta({ karta }: { karta: string | null }) {
  if (!karta) {
    // Zakryta karta krupiera: rysujemy grzbiet, żeby było widać, że jest.
    return (
      <span
        aria-label="karta zakryta"
        className="grid h-20 w-14 place-items-center rounded-md border border-white/20 bg-krew-glab/60 text-lg text-kosc/60"
      >
        ?
      </span>
    );
  }
  const kolor = karta.slice(-1);
  const ranga = karta.slice(0, -1);
  const czerwona = kolor === "h" || kolor === "d";
  return (
    <span
      aria-label={`${ranga} ${KOLOR[kolor]}`}
      className={`grid h-20 w-14 place-items-center rounded-md bg-kosc text-xl font-bold shadow ${
        czerwona ? "text-krew" : "text-noc"
      }`}
    >
      <span className="leading-none">
        {ranga}
        <br />
        {KOLOR[kolor]}
      </span>
    </span>
  );
}

function Reka({ tytul, karty, punkty, zakryta }: { tytul: string; karty: string[]; punkty: number | null; zakryta: boolean }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs uppercase tracking-[0.14em] text-dym">
        {tytul}
        {punkty !== null && <span className="ml-2 font-tytul text-base text-kosc tabular-nums">{punkty}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {karty.map((k, i) => (
          <Karta key={i} karta={k} />
        ))}
        {zakryta && <Karta karta={null} />}
      </div>
    </div>
  );
}

/**
 * Stół blackjacka. Całą grę liczy baza — przeglądarka tylko rysuje widok,
 * który dostaje z funkcji, i wysyła jeden z trzech ruchów.
 */
export function Stol({ poczatkowa, saldo }: { poczatkowa: RekaBj | null; saldo: number }) {
  const router = useRouter();
  const [reka, setReka] = useState<RekaBj | null>(poczatkowa);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  const trwa = reka?.status === "open";

  async function wywolaj(rpc: "blackjack_rozdaj" | "blackjack_ruch", parametry: Record<string, unknown>) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { data, error } = await createClient().rpc(rpc, parametry);
    // Odblokowanie przed sprawdzeniem błędu — w apce na iOS nie ma
    // przeładowania, które by zdjęło zablokowany stół.
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Ruch w blackjacku nie przeszedł:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      // Ręka mogła się w międzyczasie rozstrzygnąć sama (porzucona) — świeży stan.
      router.refresh();
      return;
    }
    setReka(data as RekaBj);
    // Saldo liczy serwer: po każdym ruchu odświeżamy stronę.
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      {reka && (
        <div className="szklo grid gap-5 rounded-md px-4 py-5">
          <Reka
            tytul="Krupier"
            karty={reka.krupier}
            punkty={reka.punkty_krupiera}
            zakryta={trwa}
          />
          <Reka tytul={`Ty · stawka ${reka.stawka}`} karty={reka.gracz} punkty={reka.punkty_gracza} zakryta={false} />

          {reka.status === "settled" && reka.wynik && (
            <p
              role="status"
              className={`text-center font-tytul text-2xl ${
                reka.wyplata && reka.wyplata > reka.stawka ? "text-krew-jasna" : "text-kosc"
              }`}
            >
              {WYNIK[reka.wynik]}
              {reka.wyplata !== null && reka.wyplata > 0 && (
                <span className="block text-sm text-dym">wypłata {reka.wyplata} pkt</span>
              )}
            </p>
          )}
        </div>
      )}

      {trwa ? (
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => void wywolaj("blackjack_ruch", { p_ruch: "dobierz" })} disabled={czeka}>
            Dobierz
          </Button>
          <Button variant="szklo" onClick={() => void wywolaj("blackjack_ruch", { p_ruch: "stan" })} disabled={czeka}>
            Stań
          </Button>
          <Button
            variant="szklo"
            onClick={() => void wywolaj("blackjack_ruch", { p_ruch: "podwoj" })}
            disabled={czeka || !reka?.mozna_podwoic}
          >
            Podwój
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="px-1 text-xs uppercase tracking-[0.14em] text-dym">
            {reka ? "Kolejne rozdanie" : "Rozdaj"} · saldo {saldo}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {STAWKI.map((s) => (
              <Button
                key={s}
                onClick={() => void wywolaj("blackjack_rozdaj", { p_stawka: s })}
                disabled={czeka || saldo < s}
              >
                {s} pkt
              </Button>
            ))}
          </div>
        </div>
      )}

      {blad && (
        <p role="alert" className="text-center text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      <p className="text-center text-xs leading-relaxed text-dym">
        Krupier dobiera do 17, także na miękkie 17 z asem. Blackjack z rozdania płaci 6:5.
        Podwojenie tylko przy 9, 10 albo 11 na dwóch pierwszych kartach. Ręka zostawiona
        na 10 minut kończy się jak „stań”.
      </p>
    </div>
  );
}
