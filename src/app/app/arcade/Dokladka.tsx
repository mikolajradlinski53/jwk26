"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";

/** Dokładka żetonów, gdy nie starcza na najmniejszą stawkę. Liczy się w rankingu jako pożyczka. */
export function Dokladka({ start }: { start: number }) {
  const router = useRouter();
  const [czeka, setCzeka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function wez() {
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc("dokladka_zetonow");
    setCzeka(false);
    if (error) {
      console.error("Dokładka nie przeszła:", error);
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 grid gap-2">
      <Button onClick={() => void wez()} disabled={czeka}>
        {czeka ? "Dokładam..." : `Weź dokładkę - ${start} żetonów`}
      </Button>
      {blad && <p className="text-center text-sm text-krew-jasna">{blad}</p>}
    </div>
  );
}
