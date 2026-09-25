"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ShopItem } from "@/types/db";

export function StanPozycji({ pozycja }: { pozycja: ShopItem }) {
  const router = useRouter();
  const [stan, setStan] = useState(
    pozycja.stock === null ? "" : String(pozycja.stock),
  );
  const [blad, setBlad] = useState<string | null>(null);
  const wToku = useRef(false);

  async function zapisz(zmiana: Partial<Pick<ShopItem, "active" | "stock">>) {
    if (wToku.current) return;
    wToku.current = true;
    setBlad(null);

    // Zapis idzie wprost przez RLS, bez funkcji: polityka shop_items_admin_write
    // przepuszcza adminowi cały zestaw operacji na tej tabeli, a zmiana stanu nie
    // dotyka ani księgi, ani zamówień, więc nie ma czego domykać transakcją.
    const { error } = await createClient()
      .from("shop_items")
      .update(zmiana)
      .eq("id", pozycja.id);

    wToku.current = false;

    if (error) {
      console.error("Zmiana pozycji nie przeszła:", error);
      setBlad(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-dym">
        <input
          type="checkbox"
          checked={pozycja.active}
          onChange={(e) => void zapisz({ active: e.target.checked })}
          className="size-4 accent-krew"
        />
        na półce
      </label>

      <input
        type="text"
        inputMode="numeric"
        value={stan}
        placeholder="bez limitu"
        aria-label={`Stan pozycji ${pozycja.name}`}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^\d*$/.test(v)) setStan(v);
        }}
        onBlur={() => void zapisz({ stock: stan === "" ? null : Number(stan) })}
        className="szklo min-h-9 w-24 rounded-sm px-2.5 text-xs text-kosc
                   outline-none placeholder:text-dym focus-visible:border-krew"
      />

      {blad && <span className="text-xs text-krew-jasna">{blad}</span>}
    </div>
  );
}
