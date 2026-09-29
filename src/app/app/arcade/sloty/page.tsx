import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { Pusto } from "@/components/Pusto";
import { Wroc } from "@/components/Wroc";
import { Bebny } from "../Bebny";
import { NAZWY_SYMBOLI } from "../Symbole";
import type { Spin, UserScore } from "@/types/db";

export default async function SlotyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: wynik }, { data: ustawienia }, { data: spiny }, { data: obrot }] =
    await Promise.all([
      supabase.from("user_scores").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["slots_stawka", "casino_daily_stake_cap"]),
      supabase
        .from("moje_spiny")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
      // Obrót liczy baza tą samą funkcją, którą wymusza spin. Liczenie go tutaj
      // z `Date.now()` byłoby dwiema prawdami o jednym limicie, a przy okazji
      // reguła react-hooks/purity w tej wersji Nexta odrzuca `Date.now()`
      // w renderze — także w komponencie serwerowym, i to jako błąd.
      supabase.rpc("obrot_w_oknie"),
    ]);

  const wg = new Map((ustawienia ?? []).map((r) => [r.key as string, r.value]));
  const stawka = Number(wg.get("slots_stawka") ?? 10);
  const limit = Number(wg.get("casino_daily_stake_cap") ?? 300);

  const saldo = (wynik as UserScore | null)?.score ?? 0;
  const historia = (spiny ?? []) as Spin[];

  return (
    <Ekran tytul="Sloty" podtytul="Gra przeciwko twojemu saldu">
      <div className="szklo mb-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Twoje saldo</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">{saldo}</strong>
      </div>

      <Bebny
        saldo={saldo}
        stawka={stawka}
        obrotPoczatkowy={Number(obrot ?? 0)}
        limit={limit}
      />

      <NaglowekSekcji>Ostatnie spiny</NaglowekSekcji>
      {historia.length === 0 ? (
        <Pusto ikona="swieca">Jeszcze żadnego spinu.</Pusto>
      ) : (
        <ol className="grid gap-1.5">
          {historia.map((s) => (
            <li
              key={s.id}
              className="szklo flex items-baseline justify-between gap-3 rounded-md px-3.5 py-2.5"
            >
              <span className="min-w-0 text-xs text-dym">
                {(s.bebny ?? []).map((x) => NAZWY_SYMBOLI[x] ?? x).join(" · ")}
              </span>
              <span
                className={
                  "flex-none font-tytul text-sm tabular-nums " +
                  (s.payout > s.stake ? "text-krew-jasna" : "text-dym")
                }
              >
                {s.payout - s.stake > 0 ? "+" : ""}
                {s.payout - s.stake}
              </span>
            </li>
          ))}
        </ol>
      )}

      <Wroc href="/app/arcade">Wróć do kasyna</Wroc>
    </Ekran>
  );
}
