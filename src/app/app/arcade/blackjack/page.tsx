import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Stol, type RekaBj } from "./Stol";
import type { UserScore } from "@/types/db";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { Pusto } from "@/components/Pusto";
import { KartaPuli, wczytajPule, zostaloZPuli } from "../Pula";

type Rozdanie = { id: string; stake: number; payout: number; wynik: string | null; created_at: string };

export default async function BlackjackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: wynik }, { data: reka }, { data: historiaRaw }, pula] =
    await Promise.all([
      supabase.from("user_scores").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("blackjack_stan"),
      supabase
        .from("moje_rozdania")
        .select("id, stake, payout, wynik, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      // Ta sama pula co w slotach - obie gry liczą się razem.
      wczytajPule(supabase),
    ]);

  const saldo = (wynik as UserScore | null)?.score ?? 0;
  const historia = (historiaRaw ?? []) as Rozdanie[];

  return (
    <Ekran tytul="Blackjack" podtytul="Gra z puli drużyny">
      <KartaPuli pula={pula} saldo={saldo} />

      <Stol poczatkowa={(reka as RekaBj | null) ?? null} pozostalo={zostaloZPuli(pula)} />

      <NaglowekSekcji>Ostatnie rozdania</NaglowekSekcji>
      {historia.length === 0 ? (
        <Pusto ikona="karty">Jeszcze żadnego rozdania.</Pusto>
      ) : (
        <ol className="grid gap-1.5">
          {historia.map((r) => (
            <li key={r.id} className="szklo flex items-baseline justify-between gap-3 rounded-md px-3.5 py-2.5">
              <span className="text-xs text-dym">
                {r.wynik ?? "-"} · stawka {r.stake}
              </span>
              <span
                className={
                  "flex-none font-tytul text-sm tabular-nums " +
                  (r.payout > r.stake ? "text-krew-jasna" : "text-dym")
                }
              >
                {r.payout - r.stake > 0 ? "+" : ""}
                {r.payout - r.stake}
              </span>
            </li>
          ))}
        </ol>
      )}

      <Wroc href="/app/arcade">Wróć do kasyna</Wroc>
    </Ekran>
  );
}
