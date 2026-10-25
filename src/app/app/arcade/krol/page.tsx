import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Pusto } from "@/components/Pusto";
import { Wroc } from "@/components/Wroc";
import { Odswiezaj } from "../Odswiezaj";

type Wiersz = {
  user_id: string;
  imie: string | null;
  druzyna: string | null;
  kolor: string | null;
  saldo: number;
  dokladki: number;
  bilans: number;
};

/**
 * Król Kasyna (2026-10-25): ranking żetonów po gali. Bilans = żetony minus
 * dokładki - dokładka to pożyczka, nie wygrana. Liczy baza (`krol_kasyna`).
 */
export default async function KrolKasynaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const { data } = await supabase.rpc("krol_kasyna");
  const lista = (data ?? []) as Wiersz[];

  return (
    <Ekran tytul="Król Kasyna" podtytul="Ranking żetonów na żywo">
      <Odswiezaj sekundy={15} />
      {lista.length === 0 ? (
        <Pusto ikona="kielich">Nikt jeszcze nie zagrał na żetonach. Zakręć slotami, a pojawisz się tutaj.</Pusto>
      ) : (
        <ol className="grid gap-1.5">
          {lista.map((w, i) => (
            <li
              key={w.user_id}
              className={
                "szklo flex items-center gap-3 rounded-md px-3.5 py-3 " +
                (w.user_id === user.id ? "ring-1 ring-krew-jasna" : "")
              }
            >
              <span className="w-7 flex-none text-center font-tytul text-lg tabular-nums text-dym">
                {i === 0 ? "♛" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{w.imie ?? "Gracz"}</span>
                <span className="flex items-center gap-1.5 text-xs text-dym">
                  {w.kolor && <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: w.kolor }} />}
                  <span className="truncate">{w.druzyna ?? "bez drużyny"}</span>
                  {w.dokladki > 0 && <span className="flex-none">· dokładki {w.dokladki}</span>}
                </span>
              </span>
              <span className="flex-none text-right">
                <strong className="block font-tytul text-lg tabular-nums">{w.bilans}</strong>
                {w.dokladki > 0 && <span className="text-xs text-dym tabular-nums">{w.saldo} żet.</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-center text-xs leading-relaxed text-dym">
        Bilans to Twoje żetony minus wszystkie dokładki - dokładka jest pożyczką, nie wygraną.
      </p>
      <Wroc href="/app/arcade">Wróć do kasyna</Wroc>
    </Ekran>
  );
}
