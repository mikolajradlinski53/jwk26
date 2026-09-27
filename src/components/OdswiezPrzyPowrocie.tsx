"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * W apce z ekranu głównego na iOS nie ma przeładowania ani pull-to-refresh,
 * a awans z rezerwy i akceptacja zgłoszenia dzieją się po stronie admina —
 * bez tego ktoś zostawałby na nieaktualnym ekranie aż do ręcznego zamknięcia
 * i ponownego otwarcia apki. Nasłuch łapie powrót z tła (`visibilitychange`)
 * i powrót z pamięci wstecz/wprzód przeglądarki (`pageshow`); przycisk jest
 * na wypadek systemów, gdzie żadne z nich się nie odpali.
 */
export function OdswiezPrzyPowrocie() {
  const router = useRouter();

  useEffect(() => {
    function naWidocznosc() {
      if (document.visibilityState === "visible") router.refresh();
    }
    function naPowrot() {
      router.refresh();
    }

    document.addEventListener("visibilitychange", naWidocznosc);
    window.addEventListener("pageshow", naPowrot);
    return () => {
      document.removeEventListener("visibilitychange", naWidocznosc);
      window.removeEventListener("pageshow", naPowrot);
    };
  }, [router]);

  return (
    <Button variant="szklo" onClick={() => router.refresh()}>
      Sprawdź ponownie
    </Button>
  );
}
