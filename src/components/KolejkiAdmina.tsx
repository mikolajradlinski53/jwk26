"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Znacznik } from "./Znacznik";

export type Kolejki = { sklepik: number; bingo: number; zgloszenia: number; gossipy: number };
const ZERO: Kolejki = { sklepik: 0, bingo: 0, zgloszenia: 0, gossipy: 0 };

const Kontekst = createContext<Kolejki>(ZERO);

/**
 * Liczniki kolejek admina (spec porządku, D1-D3). Odświeżane przy wejściu,
 * przy każdej zmianie ekranu, po powrocie do apki i co 30 s. Realtime
 * obejmuje tylko dwie tabele, a dopisywanie kolejnych dla kilku adminów nie
 * jest warte złożoności - o zamówieniach admin i tak dostaje push.
 * Uczestnik nie pyta bazy w ogóle.
 */
export function KolejkiAdmina({ jestAdminem, children }: { jestAdminem: boolean; children: React.ReactNode }) {
  const [kolejki, setKolejki] = useState<Kolejki>(ZERO);
  const sciezka = usePathname();

  useEffect(() => {
    if (!jestAdminem) return;
    let zyje = true;

    async function odswiez() {
      if (document.hidden) return;
      const { data, error } = await createClient().rpc("admin_kolejki");
      if (!zyje) return;
      if (error) {
        console.error("Kolejki admina się nie wczytały:", { code: error.code, message: error.message });
        return;
      }
      setKolejki(data as Kolejki);
    }

    // Każda zmiana ekranu odpala efekt od nowa - admin właśnie mógł coś wydać
    // albo zaakceptować, więc liczby mają dogonić stan od razu.
    void odswiez();
    const co30 = setInterval(() => void odswiez(), 30_000);
    const powrot = () => void odswiez();
    document.addEventListener("visibilitychange", powrot);
    return () => {
      zyje = false;
      clearInterval(co30);
      document.removeEventListener("visibilitychange", powrot);
    };
  }, [jestAdminem, sciezka]);

  return <Kontekst.Provider value={kolejki}>{children}</Kontekst.Provider>;
}

export function useKolejki(): Kolejki & { suma: number } {
  const k = useContext(Kontekst);
  return { ...k, suma: k.sklepik + k.bingo + k.zgloszenia + k.gossipy };
}

/** Znacznik jednej kolejki albo sumy - do wstawienia także w komponencie serwerowym. */
export function LicznikKolejki({ ktora }: { ktora: keyof Kolejki | "suma" }) {
  const liczba = useKolejki()[ktora];
  return <Znacznik liczba={liczba} etykieta={`${liczba} do zrobienia`} className="ml-auto" />;
}
