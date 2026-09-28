"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";

/**
 * Głos w jednej kategorii. Siebie nie ma na liście — funkcja w bazie i tak
 * by odmówiła, ale lepiej nie kusić przyciskiem, który zawsze odbija.
 */
export function Glosowanie({
  kategoria,
  nominowani,
  ja,
  minimum,
}: {
  kategoria: string;
  nominowani: { id: string; nazwa: string }[];
  ja: string;
  minimum: number;
}) {
  const router = useRouter();
  const [wybor, setWybor] = useState<string | null>(null);
  const [tekst, setTekst] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  const dlugosc = tekst.trim().length;
  const kandydaci = nominowani.filter((n) => n.id !== ja);

  async function wyslij() {
    if (wToku.current) return;
    setBlad(null);
    if (!wybor) {
      setBlad("Wybierz osobę");
      return;
    }
    if (dlugosc < minimum) {
      setBlad(`Uzasadnienie musi mieć co najmniej ${minimum} znaków — brakuje ${minimum - dlugosc}.`);
      return;
    }

    wToku.current = true;
    setCzeka(true);
    const { error } = await createClient().rpc("oddaj_glos", {
      p_kategoria: kategoria,
      p_nominowany: wybor,
      p_uzasadnienie: tekst.trim(),
    });
    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Głos nie przeszedł:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-xs text-dym">Twój typ</legend>
        {kandydaci.map((n) => (
          <label key={n.id} className="flex min-h-11 items-center gap-3 text-sm text-kosc">
            <input
              type="radio"
              name={`typ-${kategoria}`}
              checked={wybor === n.id}
              onChange={() => setWybor(n.id)}
              className="size-5 shrink-0 accent-[var(--color-krew)]"
            />
            <span>{n.nazwa}</span>
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
          Dlaczego? (anonimowo)
        </span>
        <textarea
          rows={5}
          maxLength={2000}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none placeholder:text-dym focus-visible:border-krew"
          placeholder="Napisz konkret — historię, cytat, moment z wyjazdu."
        />
        <span
          className={`mt-1 block text-right text-xs tabular-nums ${dlugosc >= minimum ? "text-dym" : "text-krew-jasna"}`}
          aria-live="polite"
        >
          {dlugosc} / {minimum}
        </span>
      </label>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      <Button onClick={() => void wyslij()} disabled={czeka}>
        {czeka ? "Wysyłam…" : "Oddaj głos"}
      </Button>
      <p className="text-xs leading-relaxed text-dym">
        Głos oddajesz raz i nie da się go zmienić. Nikt poza organizatorami nie zobaczy, kto
        co napisał — a po ujawnieniu pokażemy tylko uzasadnienia o zwycięzcy.
      </p>
    </div>
  );
}
