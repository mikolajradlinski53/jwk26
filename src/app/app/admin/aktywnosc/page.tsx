import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import { ListaAktywnosci, type WierszAktywnosci } from "./ListaAktywnosci";

/**
 * Kto korzysta z apki: ostatnie logowanie, powiadomienia, wpisy w zabawach.
 * Z danych, które apka już ma - bez nominacji JWK Awards (regulamin § 19).
 */
export default async function AktywnoscPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aktywnosc_uczestnikow");

  if (error) {
    console.error("Nie udało się wczytać aktywności:", error);
    return (
      <Ekran tytul="Aktywność" podtytul="Kto korzysta z apki">
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">Nie udało się wczytać aktywności. Odśwież stronę.</p>
        <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
      </Ekran>
    );
  }

  const wiersze = (data ?? []) as WierszAktywnosci[];
  // Chwila renderu na serwerze - ta sama dla podsumowania i listy.
  const teraz = new Date().getTime();
  const przyjeci = wiersze.filter((w) => w.status === "approved");
  const doba = (t: string | null) => t !== null && teraz - new Date(t).getTime() < 24 * 3600 * 1000;

  const kafle: [string, string][] = [
    ["Kont", String(wiersze.length)],
    ["Przyjętych", String(przyjeci.length)],
    ["Aktywnych w 24 h", String(wiersze.filter((w) => doba(w.ostatnia_aktywnosc)).length)],
    ["Przyjętych z powiadomieniami", `${przyjeci.filter((w) => w.powiadomienia).length}/${przyjeci.length}`],
  ];

  return (
    <Ekran tytul="Aktywność" podtytul="Kto korzysta z apki">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <div className="grid grid-cols-2 gap-2">
          {kafle.map(([etykieta, wartosc]) => (
            <div key={etykieta} className="szklo rounded-md px-3 py-3">
              <p className="font-tytul text-2xl tabular-nums text-kosc">{wartosc}</p>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-dym">{etykieta}</p>
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-dym">
          Ruch na stronie (odsłony, skąd ludzie przychodzą, kroki zapisu) jest w Vercel → Analytics. Tu tylko to,
          co apka i tak zapisuje. Nominacji z JWK Awards celowo nie ma - ich autorzy są anonimowi.
        </p>
        <ListaAktywnosci wiersze={wiersze} teraz={teraz} />
      </div>
      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
