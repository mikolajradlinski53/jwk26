import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { NAZWY_PUL } from "@/lib/zapisy/formularz";
import { Ogloszenie } from "./Ogloszenie";
import type { KluczPuli } from "@/types/db";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { Pusto } from "@/components/Pusto";

type Wpis = {
  id: number;
  tytul: string;
  body: string | null;
  adresat: string;
  adresat_id: string | null;
  pula: KluczPuli | null;
  created_at: string;
  wyslane_at: string | null;
  wyslane_do: number | null;
  proby: number;
};

const CZAS = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function OgloszeniaPage() {
  const supabase = await createClient();
  const [{ data: druzynyRaw }, { data: historiaRaw, error }] = await Promise.all([
    supabase.from("teams").select("id, name").order("name"),
    supabase
      .from("powiadomienia")
      .select("id, tytul, body, adresat, adresat_id, pula, created_at, wyslane_at, wyslane_do, proby")
      .eq("ref_type", "ogloszenie")
      .order("id", { ascending: false })
      .limit(20),
  ]);

  const druzyny = (druzynyRaw ?? []) as { id: string; name: string }[];
  const historia = (historiaRaw ?? []) as Wpis[];
  const nazwaDruzyny = new Map(druzyny.map((d) => [d.id, d.name]));

  function komu(w: Wpis) {
    if (w.adresat === "team") return nazwaDruzyny.get(w.adresat_id ?? "") ?? "drużyna";
    if (w.adresat === "pula") return w.pula ? NAZWY_PUL[w.pula] : "pula";
    return "wszyscy";
  }

  function stan(w: Wpis) {
    if (w.wyslane_at) return `dotarło do ${w.wyslane_do ?? 0} urządzeń`;
    // Po pięciu próbach wysyłka się poddaje (pobierz_push) — to trzeba widzieć.
    if (w.proby >= 5) return "nie udało się wysłać";
    return "w drodze…";
  }

  return (
    <Ekran tytul="Ogłoszenia" podtytul="Powiadomienia push">
      <Ogloszenie druzyny={druzyny} />

      <NaglowekSekcji>Wysłane</NaglowekSekcji>
      {error && (
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać historii. Odśwież stronę.
        </p>
      )}
      {!error && historia.length === 0 && (
        <Pusto>Jeszcze nic.</Pusto>
      )}
      <ol className="grid gap-1.5">
        {historia.map((w) => (
          <li key={w.id} className="szklo rounded-md px-3.5 py-2.5">
            <p className="text-sm font-bold text-kosc">{w.tytul}</p>
            {w.body && <p className="text-sm text-dym">{w.body}</p>}
            <p className="mt-1 text-xs text-dym">
              {CZAS.format(new Date(w.created_at))} · {komu(w)} · {stan(w)}
            </p>
          </li>
        ))}
      </ol>

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
