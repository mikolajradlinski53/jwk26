"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import type { Team } from "@/types/db";

export type OsobaDoPrzydzialu = {
  id: string;
  nazwa: string;
  podpis: string;
  kadra: boolean;
  teamId: string | null;
};

/**
 * Przydział do drużyn po przyjęciu (2026-10-13): zgłoszenia przyjmuje się bez
 * drużyny, a tu rozdziela - ręcznie albo po równo jednym przyciskiem. Limit
 * pilnuje baza; Kadra się do niego nie liczy.
 */
export function Przydzial({
  osoby,
  druzyny,
  limit,
}: {
  osoby: OsobaDoPrzydzialu[];
  druzyny: Team[];
  limit: number;
}) {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [czeka, setCzeka] = useState<string | null>(null);
  const wToku = useRef(false);

  const obsadzenie: Record<string, number> = {};
  for (const o of osoby) if (o.teamId && !o.kadra) obsadzenie[o.teamId] = (obsadzenie[o.teamId] ?? 0) + 1;
  const bez = osoby.filter((o) => !o.teamId && !o.kadra);
  const kolejnosc = [...osoby].sort(
    (a, b) => Number(Boolean(a.teamId)) - Number(Boolean(b.teamId)) || a.nazwa.localeCompare(b.nazwa, "pl"),
  );

  async function wykonaj(klucz: string, zapytanie: () => PromiseLike<{ data?: unknown; error: { message: string } | null }>) {
    if (wToku.current) return null;
    wToku.current = true;
    setCzeka(klucz);
    setBlad(null);
    setInfo(null);
    const { data, error } = await zapytanie();
    setCzeka(null);
    wToku.current = false;
    if (error) {
      console.error("Przydział nie przeszedł:", error);
      setBlad(/DRUZYNA_PELNA/.test(error.message) ? komunikat(error) : error.message);
      router.refresh();
      return null;
    }
    router.refresh();
    return data ?? true;
  }

  async function rozdziel() {
    if (!window.confirm(`Rozdzielić ${bez.length} osób bez drużyny po równo między drużyny?`)) return;
    const wynik = (await wykonaj("rozdziel", () => createClient().rpc("rozdziel_bez_druzyny"))) as
      | { przydzielono: number; bez_miejsca: number }
      | null;
    if (wynik && typeof wynik === "object") {
      setInfo(
        `Przydzielono ${wynik.przydzielono}.` +
          (wynik.bez_miejsca > 0 ? ` Dla ${wynik.bez_miejsca} zabrakło miejsc - podnieś limit albo przydziel ręcznie.` : ""),
      );
    }
  }

  return (
    <section className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3">
      <h2 className="text-sm font-bold">Przydział do drużyn</h2>
      <p className="text-xs leading-relaxed text-dym">
        Bez drużyny: {bez.length}. Limit {limit} uczestników na drużynę (Kadra się nie liczy):{" "}
        {druzyny.map((d) => `${d.name.replace("Drużyna ", "D")} ${obsadzenie[d.id] ?? 0}`).join(" · ")}
      </p>
      {bez.length > 0 && (
        <Button onClick={rozdziel} disabled={czeka !== null}>
          {czeka === "rozdziel" ? "Rozdzielam..." : `Rozdziel po równo (${bez.length})`}
        </Button>
      )}
      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      {info && <p className="text-sm text-kosc">{info}</p>}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {kolejnosc.map((o) => (
          <li key={o.id} className="szklo flex items-center gap-3 rounded-md px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-kosc">{o.nazwa}</span>
              <span className="block truncate text-xs text-dym">
                {o.kadra ? "Kadra" : o.podpis}
              </span>
            </span>
            <select
              aria-label={`Drużyna: ${o.nazwa}`}
              value={o.teamId ?? ""}
              disabled={czeka !== null}
              onChange={(e) =>
                void wykonaj(o.id, () =>
                  createClient().rpc("przydziel_druzyne", { p_user: o.id, p_team: e.target.value || null }),
                )
              }
              className="szklo min-h-10 w-32 shrink-0 rounded-sm px-2 text-sm text-kosc outline-none focus-visible:border-krew"
            >
              <option value="">Bez drużyny</option>
              {druzyny.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}
