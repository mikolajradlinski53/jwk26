"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Co ile odświeżać awaryjnie, gdyby realtime nie dowiózł zdarzenia (słaby zasięg). */
const ODSWIEZANIE_AWARYJNE_MS = 15_000;

/**
 * Odświeża ekran licytacji po nowej ofercie i po zamknięciu/zmianie licytacji.
 * Zdarzenie niesie tylko sygnał - stan i tak liczy baza (licytacje_lista).
 *
 * Token sesji trafia do realtime przed subskrypcją: klient w przeglądarce
 * wczytuje sesję asynchronicznie, a kanał otwarty wcześniej działa jako anon
 * i RLS (is_approved) odcina mu wszystkie zdarzenia - sprawdzone w e2e
 * 2026-10-22. `wait: true` jak w RankingNaZywo. Do tego odświeżanie co 15 s,
 * bo na wyjeździe zasięg bywa słaby, a licytacja ma minuty, nie sekundy.
 * Tabela `licytacje` jest czytelna tylko dla admina (licytacje w ciemno), więc
 * uczestnik dostaje zdarzenia tylko z ofert - zamknięcie łapie odświeżanie.
 */
export function LicytacjeNaZywo() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let porzucone = false;
    let czeka: number | null = null;
    let kanal: ReturnType<typeof supabase.channel> | null = null;

    // Kilka ofert w jednej sekundzie = jedno odświeżenie.
    const odswiez = () => {
      if (czeka !== null) return;
      czeka = window.setTimeout(() => {
        czeka = null;
        router.refresh();
      }, 400);
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (porzucone) return;
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (porzucone) return;
      kanal = supabase
        .channel("licytacje", { config: { postgres_changes_options: { wait: true } } })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "licytacje_oferty" }, odswiez)
        .on("postgres_changes", { event: "*", schema: "public", table: "licytacje" }, odswiez)
        .subscribe();
    })();

    const awaryjne = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ODSWIEZANIE_AWARYJNE_MS);

    return () => {
      porzucone = true;
      window.clearInterval(awaryjne);
      if (czeka !== null) window.clearTimeout(czeka);
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [router]);

  return null;
}
