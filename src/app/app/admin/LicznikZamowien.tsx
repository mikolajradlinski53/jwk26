"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LicznikZamowien({ poczatkowa }: { poczatkowa: number }) {
  const [ile, setIle] = useState(poczatkowa);

  const odswiez = useCallback(async () => {
    const { count } = await createClient()
      .from("shop_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setIle(count ?? 0);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Ten sam mechanizm co RankingNaZywo. Dwa warunki przeniesione z tamtej
    // lekcji, oba niewidoczne dla testów bazy:
    //
    // 1. `wait: true` — bez tego `subscribe()` zgłasza SUBSCRIBED już w chwili
    //    dołączenia do kanału, zanim serwer uruchomi subskrypcję postgres_changes
    //    na replikacji. Zamówienie złożone w tym oknie ginie bez żadnego błędu
    //    po stronie klienta.
    // 2. `shop_orders` musi być w publikacji `supabase_realtime` — dopisane
    //    w migracji 20260925120000. Bez tego ten kod wygląda poprawnie i nie
    //    drga nigdy.
    //
    // Nasłuchujemy `*`, nie tylko INSERT: wydanie i anulowanie to UPDATE-y, po
    // których licznik ma zejść. Zdarzenie niesie wyłącznie sygnał „coś się
    // zmieniło", bo interesuje nas stan kolejki, a nie treść wiersza.
    const kanal = supabase
      .channel("kolejka-sklepiku", {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_orders" },
        () => {
          void odswiez();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [odswiez]);

  if (ile === 0) return null;

  return (
    <span
      aria-label={`${ile} oczekujących zamówień`}
      className="ml-auto grid size-6 flex-none place-items-center rounded-full
                 bg-gradient-to-b from-krew to-krew-glab text-[0.68rem] font-bold
                 tabular-nums text-white
                 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
    >
      {ile}
    </span>
  );
}
