"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Odświeża ekran licytacji po nowej ofercie i po zamknięciu/zmianie licytacji.
 * Zdarzenie niesie tylko sygnał - stan i tak liczy baza (licytacje_lista).
 * `wait: true` jak w RankingNaZywo: bez tego pierwsze zdarzenie po wejściu ginie.
 */
export function LicytacjeNaZywo() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let czeka: number | null = null;
    // Kilka ofert w jednej sekundzie = jedno odświeżenie.
    const odswiez = () => {
      if (czeka !== null) return;
      czeka = window.setTimeout(() => {
        czeka = null;
        router.refresh();
      }, 400);
    };
    const kanal = supabase
      .channel("licytacje", { config: { postgres_changes_options: { wait: true } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "licytacje_oferty" }, odswiez)
      .on("postgres_changes", { event: "*", schema: "public", table: "licytacje" }, odswiez)
      .subscribe();
    return () => {
      if (czeka !== null) window.clearTimeout(czeka);
      void supabase.removeChannel(kanal);
    };
  }, [router]);

  return null;
}
