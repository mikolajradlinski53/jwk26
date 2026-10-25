"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { komunikat } from "@/lib/zapisy/bledy";
import { Karta } from "../blackjack/Stol";

export type Gracz = { id: string; imie: string; druzyna: string | null };
export type Wyzwanie = {
  id: string;
  od: string;
  od_imie: string | null;
  do_kogo: string;
  do_imie: string | null;
  stawka: number;
  status: "czeka" | "rozegrane" | "odrzucone" | "anulowane";
  karty_od: string[] | null;
  karty_do: string[] | null;
  zwyciezca: string | null;
  created_at: string;
};

const STAWKI = [10, 50, 100, 250, 500];

function Reka({ imie, karty }: { imie: string; karty: string[] }) {
  return (
    <div className="grid justify-items-center gap-2">
      <span className="text-xs text-dym">{imie}</span>
      <div className="flex gap-1.5">
        {karty.map((k, i) => (
          <Karta key={i} karta={k} />
        ))}
      </div>
    </div>
  );
}

export function Wyzwania({
  ja,
  saldo,
  gracze,
  wyzwania,
}: {
  ja: string;
  saldo: number;
  gracze: Gracz[];
  wyzwania: Wyzwanie[];
}) {
  const router = useRouter();
  const [rywal, setRywal] = useState("");
  const [stawka, setStawka] = useState(50);
  const [czeka, setCzeka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const wToku = useRef(false);

  async function wywolaj(rpc: string, parametry: Record<string, unknown>, sukces: string) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    setInfo(null);
    const { error } = await createClient().rpc(rpc, parametry);
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${rpc} nie przeszło:`, error);
      setBlad(komunikat(error));
    } else {
      setInfo(sukces);
    }
    router.refresh();
  }

  const doMnie = wyzwania.filter((w) => w.status === "czeka" && w.do_kogo === ja);
  const odeMnie = wyzwania.filter((w) => w.status === "czeka" && w.od === ja);
  const historia = wyzwania.filter((w) => w.status !== "czeka");

  return (
    <div className="grid gap-2">
      <div className="szklo grid gap-3 rounded-md px-4 py-4">
        <p className="text-sm leading-relaxed text-dym">
          Rzuć wyzwanie i postaw żetony. Twoja stawka schodzi od razu. Jeśli ktoś przyjmie, każdy dostaje dwie karty
          i bliżej 21 zgarnia całą pulę. Remis zwraca stawki. Masz {saldo} żetonów.
        </p>
        <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-dym">
          Kogo wyzywasz
          <select
            value={rywal}
            onChange={(e) => setRywal(e.target.value)}
            className="szklo min-h-12 rounded-md px-3 text-base normal-case tracking-normal text-kosc"
          >
            <option value="">Wybierz osobę…</option>
            {gracze.map((g) => (
              <option key={g.id} value={g.id}>
                {g.imie}
                {g.druzyna ? ` · ${g.druzyna}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {STAWKI.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStawka(s)}
              disabled={s > saldo}
              aria-pressed={stawka === s}
              className={
                "min-h-11 rounded-md text-sm font-bold tabular-nums disabled:opacity-40 " +
                (stawka === s ? "bg-krew text-kosc" : "szklo text-kosc")
              }
            >
              {s}
            </button>
          ))}
        </div>
        <Button
          onClick={() => void wywolaj("wyzwij", { p_do: rywal, p_stawka: stawka }, "Wyzwanie wysłane - dostanie push.")}
          disabled={czeka || !rywal || stawka > saldo}
        >
          {czeka ? "Chwila..." : `Wyzwij o ${stawka} żetonów`}
        </Button>
        {blad && <p role="alert" className="text-center text-sm text-krew-jasna">{blad}</p>}
        {info && <p role="status" className="text-center text-sm text-kosc">{info}</p>}
      </div>

      {doMnie.length > 0 && <NaglowekSekcji>Czekają na Ciebie</NaglowekSekcji>}
      {doMnie.map((w) => (
        <div key={w.id} className="szklo grid gap-3 rounded-md px-4 py-4">
          <p className="text-sm">
            <strong>{w.od_imie ?? "Ktoś"}</strong> wyzywa Cię o{" "}
            <strong className="font-tytul tabular-nums">{w.stawka}</strong> żetonów
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => void wywolaj("przyjmij_wyzwanie", { p_id: w.id }, "Pojedynek rozegrany - wynik poniżej.")}
              disabled={czeka || w.stawka > saldo}
            >
              Przyjmij
            </Button>
            <Button
              variant="szklo"
              onClick={() => void wywolaj("zamknij_wyzwanie", { p_id: w.id }, "Wyzwanie odrzucone.")}
              disabled={czeka}
            >
              Odrzuć
            </Button>
          </div>
        </div>
      ))}

      {odeMnie.length > 0 && <NaglowekSekcji>Twoje wyzwania bez odpowiedzi</NaglowekSekcji>}
      {odeMnie.map((w) => (
        <div key={w.id} className="szklo flex items-center justify-between gap-3 rounded-md px-4 py-3">
          <span className="min-w-0 text-sm">
            {w.do_imie ?? "Ktoś"} · <span className="font-tytul tabular-nums">{w.stawka}</span> żet.
          </span>
          <Button
            variant="szklo"
            onClick={() => void wywolaj("zamknij_wyzwanie", { p_id: w.id }, "Wyzwanie anulowane, żetony wróciły.")}
            disabled={czeka}
          >
            Anuluj
          </Button>
        </div>
      ))}

      {historia.length > 0 && <NaglowekSekcji>Rozegrane</NaglowekSekcji>}
      {historia.map((w) => {
        const wygralem = w.zwyciezca === ja;
        const remis = w.status === "rozegrane" && w.zwyciezca === null;
        return (
          <div key={w.id} className="szklo grid gap-3 rounded-md px-4 py-4">
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                {w.od_imie ?? "Ktoś"} vs {w.do_imie ?? "Ktoś"}
              </span>
              <strong
                className={
                  "flex-none font-tytul tabular-nums " +
                  (w.status !== "rozegrane" ? "text-dym" : wygralem ? "text-krew-jasna" : "text-kosc")
                }
              >
                {w.status === "odrzucone"
                  ? "odrzucone"
                  : w.status === "anulowane"
                    ? "anulowane"
                    : remis
                      ? "remis"
                      : wygralem
                        ? `+${w.stawka}`
                        : `−${w.stawka}`}
              </strong>
            </p>
            {w.status === "rozegrane" && w.karty_od && w.karty_do && (
              <div className="flex justify-around gap-2">
                <Reka imie={w.od_imie ?? "Wyzywający"} karty={w.karty_od} />
                <Reka imie={w.do_imie ?? "Wyzwany"} karty={w.karty_do} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
