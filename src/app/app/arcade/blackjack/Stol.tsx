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
  remis: "Remis - stawka wraca",
  przegrana: "Przegrana",
  fura: "Fura - ponad 21",
};

const KOLOR: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

/**
 * Karta jak prawdziwa: kremowa twarz, ciemne piki i trefle, głęboko czerwone
 * kiery i kara (kontrast 6-17:1). Wcześniej szklana tafla z różowym kierem na
 * szarym tle - ok. 3:1, trzeba się było przyglądać. Ranga w rogu i duży kolor
 * pośrodku: rozpoznaje się ją z odległości wyciągniętej ręki.
 */
function Karta({ karta }: { karta: string | null }) {
  if (!karta) {
    // Zakryta karta krupiera: ciemny rewers z czerwonym wzorem - od razu widać,
    // że karta jest, i że to nie jest odkryta karta.
    return (
      <span
        aria-label="karta zakryta"
        className="grid h-24 w-16 place-items-center rounded-[10px] border-2 border-krew-jasna/60 bg-krew-glab
                   bg-[repeating-linear-gradient(45deg,rgb(255_255_255/0.08)_0_4px,transparent_4px_9px)]
                   text-krew-jasna shadow-[0_8px_18px_rgb(0_0_0/0.4)]"
      >
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M12 3 20 12 12 21 4 12Z" />
          <path d="M12 8 16 12 12 16 8 12Z" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  }
  const kolor = karta.slice(-1);
  const ranga = karta.slice(0, -1);
  const czerwona = kolor === "h" || kolor === "d";
  return (
    <span
      aria-label={`${ranga} ${KOLOR[kolor]}`}
      className={
        "relative grid h-24 w-16 place-items-center rounded-[10px] border border-black/10 bg-[#f4eeeb] " +
        "shadow-[0_8px_18px_rgb(0_0_0/0.4)] " +
        (czerwona ? "text-[#b3192b]" : "text-[#1a1214]")
      }
    >
      <span aria-hidden="true" className="absolute left-1.5 top-1 text-center font-tytul text-base font-bold leading-none">
        {ranga}
        <br />
        <span className="text-sm">{KOLOR[kolor]}</span>
      </span>
      <span aria-hidden="true" className="text-3xl leading-none">
        {KOLOR[kolor]}
      </span>
    </span>
  );
}

function Reka({
  tytul,
  karty,
  punkty,
  zakryta,
  stawka,
}: {
  tytul: string;
  karty: string[];
  punkty: number | null;
  zakryta: boolean;
  stawka?: number;
}) {
  return (
    <div className="grid gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs uppercase tracking-[0.14em] text-dym">
        {tytul}
        {punkty !== null && (
          <span className="normal-case tracking-normal">
            suma <span className="font-tytul text-base text-kosc tabular-nums">{punkty}</span>
          </span>
        )}
        {stawka !== undefined && <span className="normal-case tracking-normal">· stawka {stawka} pkt</span>}
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
 * Stół blackjacka. Całą grę liczy baza - przeglądarka tylko rysuje widok,
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
    // Odblokowanie przed sprawdzeniem błędu - w apce na iOS nie ma
    // przeładowania, które by zdjęło zablokowany stół.
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Ruch w blackjacku nie przeszedł:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      // Ręka mogła się w międzyczasie rozstrzygnąć sama (porzucona) - świeży stan.
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
          <Reka tytul="Ty" karty={reka.gracz} punkty={reka.punkty_gracza} zakryta={false} stawka={reka.stawka} />

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
