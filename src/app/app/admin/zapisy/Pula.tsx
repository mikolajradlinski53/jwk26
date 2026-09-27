"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";
import type { StanPuli } from "@/types/db";

export function Pula({
  pula,
  regulaminZatwierdzony,
}: {
  pula: StanPuli;
  regulaminZatwierdzony: boolean;
}) {
  const router = useRouter();
  const [otwarta, setOtwarta] = useState(pula.otwarta);
  const [miejsca, setMiejsca] = useState(String(pula.miejsca));
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  // Zamkniętej puli nie da się otworzyć przy roboczym regulaminie; otwartą
  // da się zamknąć zawsze.
  const zablokowana = !regulaminZatwierdzony && !pula.otwarta;
  // Zablokowany checkbox ma pokazywać stan z serwera, nie ostatnie kliknięcie
  // sprzed zablokowania — inaczej wyglądałby na odznaczony, choć pula wciąż
  // jest otwarta.
  const otwartaEfektywnie = zablokowana ? pula.otwarta : otwarta;
  const zmieniona = otwartaEfektywnie !== pula.otwarta || miejsca !== String(pula.miejsca);

  async function zapisz() {
    if (wToku.current) return;
    const liczba = Number(miejsca);
    // Number("") daje 0, więc puste pole bez tej sprawdzki ciche wpisałoby
    // zero miejsc zamiast zgłosić błąd.
    if (miejsca.trim() === "" || !Number.isInteger(liczba) || liczba < 0 || liczba > 10000) {
      setBlad("Liczba miejsc to liczba całkowita od 0 do 10 000");
      return;
    }

    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    const { error } = await createClient().rpc("ustaw_pule", {
      p_klucz: pula.klucz,
      p_otwarta: otwarta,
      p_miejsca: liczba,
    });

    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Zmiana puli nie przeszła:", error);
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  return (
    <section className="szklo grid gap-3 rounded-md px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">{pula.nazwa}</h2>
        <span className="text-xs tabular-nums text-dym">
          {pula.zajete} / {pula.miejsca} · rezerwa {pula.w_rezerwie}
        </span>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={otwartaEfektywnie}
          disabled={zablokowana}
          onChange={(e) => setOtwarta(e.target.checked)}
          className="size-6 shrink-0 accent-[var(--color-krew)]"
        />
        <span>Zapisy otwarte</span>
      </label>
      {zablokowana && (
        <p className="-mt-2 text-xs text-dym">Otworzysz ją po zatwierdzeniu regulaminu.</p>
      )}

      <Field
        label="Liczba miejsc"
        type="number"
        inputMode="numeric"
        min={0}
        value={miejsca}
        onChange={(e) => setMiejsca(e.target.value)}
      />
      {Number(miejsca) < pula.zajete && (
        <p className="-mt-2 text-xs text-dym">
          Mniej niż zajętych ({pula.zajete}). Nikt nie wylatuje, ale nikt nowy nie wejdzie.
        </p>
      )}

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      <Button onClick={() => void zapisz()} disabled={czeka || !zmieniona}>
        {czeka ? "Zapisuję..." : "Zapisz"}
      </Button>
    </section>
  );
}
