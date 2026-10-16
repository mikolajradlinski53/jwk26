import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pula kasyna (2026-10-15): w każdym oknie 12 h (00-12 i 12-24) można
 * postawić najwyżej 25% punktów drużyny z otwarcia okna podzielone przez
 * liczbę jej członków. Liczy baza (`pula_kasyna`) - tą samą funkcją, którą
 * wymusza spin i rozdanie.
 */
export type Pula = { limit: number; obrot: number; do: string };

export async function wczytajPule(supabase: SupabaseClient): Promise<Pula> {
  const { data, error } = await supabase.rpc("pula_kasyna");
  if (error || !data) {
    if (error) console.error("Pula kasyna nie wczytana:", error);
    return { limit: 0, obrot: 0, do: "" };
  }
  return data as Pula;
}

export function zostaloZPuli(p: Pula): number {
  return Math.max(0, p.limit - p.obrot);
}

/** „o 12:00” albo „o północy” - koniec bieżącego okna, czas polski. */
export function koniecOkna(p: Pula): string {
  if (!p.do) return "o 12:00 i o północy";
  const godzina = new Date(p.do).toLocaleTimeString("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
  });
  return godzina === "00:00" || godzina === "24:00" ? "o północy" : `o ${godzina}`;
}

export function KartaPuli({ pula, saldo }: { pula: Pula; saldo: number }) {
  const zostalo = zostaloZPuli(pula);
  return (
    <div className="szklo mb-4 rounded-md px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Twoja pula</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">
          {zostalo}
          <span className="text-sm text-dym"> / {pula.limit}</span>
        </strong>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-dym">
        {pula.limit === 0
          ? `Drużyna nie miała jeszcze punktów na początku tego okna, więc pula jest pusta. Nowa ${koniecOkna(pula)}.`
          : `Ćwierć punktów drużyny z początku okna, podzielona na jej członków. Liczą się postawione stawki. Nowa pula ${koniecOkna(pula)}.`}{" "}
        Twój wynik osobisty: {saldo} pkt.
      </p>
    </div>
  );
}
