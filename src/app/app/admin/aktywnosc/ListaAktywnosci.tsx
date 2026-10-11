"use client";

import { useState } from "react";
import { NAZWY_PUL } from "@/lib/zapisy/formularz";

export type WierszAktywnosci = {
  id: string;
  nazwa: string;
  email: string;
  rola: string;
  status: string;
  pula: string | null;
  konto_od: string;
  ostatnie_logowanie: string | null;
  powiadomienia: boolean;
  bingo: number;
  feed: number;
  gry: number;
  sklep: number;
  zawody: number;
  ostatnia_aktywnosc: string | null;
};

type Filtr = "wszyscy" | "przyjeci" | "bez-powiadomien" | "nieaktywni";

const FILTRY: [Filtr, string][] = [
  ["wszyscy", "Wszyscy"],
  ["przyjeci", "Przyjęci"],
  ["bez-powiadomien", "Bez powiadomień"],
  ["nieaktywni", "Cisza od 24 h"],
];

const STATUS: Record<string, string> = { approved: "przyjęty", pending: "czeka", rejected: "odrzucony" };

/** „1 osoba”, „3 osoby”, „5 osób”, „22 osoby”. */
function ileOsob(n: number): string {
  if (n === 1) return "1 osoba";
  const d = n % 10;
  const s = n % 100;
  return `${n} ${d >= 2 && d <= 4 && (s < 12 || s > 14) ? "osoby" : "osób"}`;
}

/** „5 min temu”, „3 h temu”, „2 dni temu”. */
function temu(iso: string | null, teraz: number): string {
  if (!iso) return "nigdy";
  const min = Math.round((teraz - new Date(iso).getTime()) / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h temu`;
  return `${Math.round(h / 24)} dni temu`;
}

export function ListaAktywnosci({ wiersze, teraz }: { wiersze: WierszAktywnosci[]; teraz: number }) {
  const [filtr, setFiltr] = useState<Filtr>("przyjeci");
  const dzien = 24 * 3600 * 1000;
  const widoczne = wiersze.filter((w) => {
    if (filtr === "przyjeci") return w.status === "approved";
    if (filtr === "bez-powiadomien") return w.status === "approved" && !w.powiadomienia;
    if (filtr === "nieaktywni")
      return w.status === "approved" && (!w.ostatnia_aktywnosc || teraz - new Date(w.ostatnia_aktywnosc).getTime() > dzien);
    return true;
  });

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr">
        {FILTRY.map(([k, etykieta]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltr(k)}
            aria-pressed={filtr === k}
            className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
              filtr === k ? "border-krew bg-krew/30 text-kosc" : "border-kosc/15 text-dym"
            }`}
          >
            {etykieta}
          </button>
        ))}
      </div>
      <p className="text-xs text-dym">{ileOsob(widoczne.length)}</p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {widoczne.map((w) => (
          <li key={w.id} className="szklo rounded-md px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-bold text-kosc">{w.nazwa}</p>
              <p className="shrink-0 text-xs text-dym">{temu(w.ostatnia_aktywnosc, teraz)}</p>
            </div>
            <p className="truncate text-xs text-dym">
              {w.email} · {STATUS[w.status] ?? w.status}
              {w.pula ? ` · ${NAZWY_PUL[w.pula as keyof typeof NAZWY_PUL] ?? w.pula}` : ""}
              {w.rola === "admin" ? " · admin" : ""}
            </p>
            <p className="mt-1 text-xs text-kosc/85">
              Logowanie: {temu(w.ostatnie_logowanie, teraz)} · {w.powiadomienia ? "powiadomienia włączone" : "bez powiadomień"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-dym">
              Bingo {w.bingo} · feed {w.feed} · gry {w.gry} · sklepik {w.sklep} · zawody {w.zawody}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
