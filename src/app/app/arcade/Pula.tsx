import type { SupabaseClient } from "@supabase/supabase-js";
import { Dokladka } from "./Dokladka";

/**
 * Pula kasyna (2026-10-15): w każdym oknie 12 h (00-12 i 12-24) można
 * postawić najwyżej 25% punktów drużyny z otwarcia okna podzielone przez
 * liczbę jej członków. Liczy baza (`pula_kasyna`) - tą samą funkcją, którą
 * wymusza spin i rozdanie.
 *
 * Po gali (2026-10-25) kasyno może grać na żetonach (`kasyno_zetony`): wtedy
 * baza zwraca limit = obrót + saldo żetonów, więc liczniki spinów i rozdań
 * działają bez zmian, a punkty drużyn stoją.
 */
export type Zetony = { tryb: boolean; saldo: number; dokladki: number; start: number; jackpot: number };
export type Pula = { limit: number; obrot: number; do: string; zetony: Zetony | null };

export async function wczytajPule(supabase: SupabaseClient): Promise<Pula> {
  const [{ data, error }, { data: z }] = await Promise.all([
    supabase.rpc("pula_kasyna"),
    supabase.rpc("moje_zetony"),
  ]);
  const zetony = (z as Zetony | null)?.tryb ? (z as Zetony) : null;
  if (error || !data) {
    if (error) console.error("Pula kasyna nie wczytana:", error);
    return { limit: 0, obrot: 0, do: "", zetony };
  }
  return { ...(data as Omit<Pula, "zetony">), zetony };
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

function KartaZetonow({ z }: { z: Zetony }) {
  return (
    <div className="szklo mb-4 rounded-md px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Twoje żetony</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">{z.saldo}</strong>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-dym">Jackpot - trzy Oka go zgarniają</span>
        <strong className="font-tytul text-base tabular-nums text-krew-jasna">{z.jackpot}</strong>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-dym">
        Gramy na żetonach - punkty drużyn i ranking JWK są już zamknięte. Bez limitu czasu: grasz, dopóki masz
        żetony.{z.dokladki > 0 && ` Dokładki: ${z.dokladki} (każda odejmuje ${z.start} od bilansu w rankingu).`}
      </p>
      {z.saldo < 10 && <Dokladka start={z.start} />}
    </div>
  );
}

export function KartaPuli({ pula, saldo }: { pula: Pula; saldo: number }) {
  if (pula.zetony) return <KartaZetonow z={pula.zetony} />;
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
