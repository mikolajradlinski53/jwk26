import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Stol, type RekaBj } from "./Stol";
import type { UserScore } from "@/types/db";

type Rozdanie = { id: string; stake: number; payout: number; wynik: string | null; created_at: string };

export default async function BlackjackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: wynik }, { data: reka }, { data: historiaRaw }, { data: obrot }, { data: limitRaw }] =
    await Promise.all([
      supabase.from("user_scores").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("blackjack_stan"),
      supabase
        .from("moje_rozdania")
        .select("id, stake, payout, wynik, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      // Ten sam limit co w slotach — obie gry liczą się razem.
      supabase.rpc("obrot_w_oknie"),
      supabase.from("app_settings").select("value").eq("key", "casino_daily_stake_cap").maybeSingle(),
    ]);

  const saldo = (wynik as UserScore | null)?.score ?? 0;
  const historia = (historiaRaw ?? []) as Rozdanie[];
  const limit = Number(limitRaw?.value ?? 300);

  return (
    <Ekran tytul="Blackjack" podtytul="Gra przeciwko twojemu saldu">
      <div className="szklo mb-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Twoje saldo</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">{saldo}</strong>
      </div>
      <p className="mb-4 px-1 text-xs text-dym">
        Obrót w ostatnich 24 h: {Number(obrot ?? 0)} z {limit} pkt (razem ze slotami).
      </p>

      <Stol poczatkowa={(reka as RekaBj | null) ?? null} saldo={saldo} />

      <h2 className="mb-2.5 mt-8 px-1 text-xs uppercase tracking-[0.14em] text-dym">Ostatnie rozdania</h2>
      {historia.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">Jeszcze żadnego rozdania.</p>
      ) : (
        <ol className="grid gap-1.5">
          {historia.map((r) => (
            <li key={r.id} className="szklo flex items-baseline justify-between gap-3 rounded-md px-3.5 py-2.5">
              <span className="text-xs text-dym">
                {r.wynik ?? "—"} · stawka {r.stake}
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

      <Link
        href="/app/arcade"
        className="mt-7 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
      >
        Wróć do kasyna
      </Link>
    </Ekran>
  );
}
