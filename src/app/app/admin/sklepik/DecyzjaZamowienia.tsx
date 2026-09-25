"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function DecyzjaZamowienia({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [notatka, setNotatka] = useState("");
  const [anulowanie, setAnulowanie] = useState(false);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function wykonaj(akcja: "wydaj" | "anuluj") {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const supabase = createClient();
    const { error } =
      akcja === "wydaj"
        ? await supabase.rpc("wydaj_zamowienie", { p_order_id: orderId })
        : await supabase.rpc("anuluj_zamowienie", {
            p_order_id: orderId,
            p_note: notatka.trim() || null,
          });

    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Decyzja o zamówieniu nie przeszła:", error);
      setBlad(error.message);
      return;
    }

    router.refresh();
  }

  if (anulowanie) {
    return (
      <div className="mt-2.5 grid gap-2">
        <textarea
          value={notatka}
          onChange={(e) => setNotatka(e.target.value)}
          rows={2}
          placeholder="Dlaczego (widoczne w kronice)"
          className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm
                     text-kosc outline-none placeholder:text-dym focus-visible:border-krew"
        />
        {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
        <Button onClick={() => void wykonaj("anuluj")} disabled={czeka}>
          {czeka ? "Anuluję..." : "Anuluj i zwróć punkty"}
        </Button>
        <Button variant="cichy" onClick={() => setAnulowanie(false)}>
          Wróć
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2.5 grid gap-2">
      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
      <Button onClick={() => void wykonaj("wydaj")} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Wydane"}
      </Button>
      <Button variant="cichy" onClick={() => setAnulowanie(true)}>
        Anuluj zamówienie
      </Button>
    </div>
  );
}
