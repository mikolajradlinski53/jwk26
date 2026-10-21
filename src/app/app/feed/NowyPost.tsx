"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { komunikatZdjecia, wyslijZdjecieZadania } from "@/lib/zgloszenieZdjecia";
import { zdarzenie } from "@/lib/zdarzenia";

/**
 * Swobodny post w feedzie: jedno zdjęcie i podpis, widoczny od razu, bez
 * punktów (decyzja Mikołaja 2026-10-21). Zwinięty do jednego przycisku, żeby
 * nie spychał feedu w dół.
 */
export function NowyPost({ userId, teamId }: { userId: string; teamId: string }) {
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [plik, setPlik] = useState<File | null>(null);
  const [podpis, setPodpis] = useState("");
  const [etap, setEtap] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const wToku = useRef(false);

  async function opublikuj() {
    if (wToku.current) return;
    setBlad(null);
    if (!plik) {
      setBlad("Wybierz zdjęcie.");
      return;
    }
    wToku.current = true;
    try {
      await wyslijZdjecieZadania({ userId, teamId, taskId: null, plik, podpis, etap: setEtap });
      zdarzenie("feed", { akcja: "post" });
      setPlik(null);
      setPodpis("");
      setOtwarty(false);
      router.refresh();
    } catch (e) {
      console.error("Post do feedu nie przeszedł:", e);
      setBlad(komunikatZdjecia(e, "Coś poszło nie tak. Spróbuj jeszcze raz."));
    } finally {
      setEtap(null);
      wToku.current = false;
    }
  }

  if (!otwarty) {
    return (
      <Button onClick={() => setOtwarty(true)} className="mb-5 w-full">
        + Dodaj zdjęcie
      </Button>
    );
  }

  return (
    <section aria-label="Nowy post" className="szklo mb-5 grid gap-3 rounded-lg p-4">
      <label className="block">
        <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
          Zdjęcie
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setPlik(e.target.files?.[0] ?? null);
            setBlad(null);
          }}
          className="block w-full text-sm text-dym
                     file:mr-3 file:min-h-11 file:rounded-full file:border-0
                     file:bg-krew file:px-4 file:text-xs file:font-bold file:text-white"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
          Podpis (opcjonalnie)
        </span>
        <input
          value={podpis}
          onChange={(e) => setPodpis(e.target.value.slice(0, 300))}
          placeholder="Co się dzieje?"
          className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none
                     placeholder:text-dym focus-visible:border-krew"
        />
      </label>
      <p className="text-xs leading-relaxed text-dym">
        Post widzą od razu wszyscy uczestnicy. Wrzucaj tylko zdjęcia osób, które się na to zgadzają - Kadra
        usuwa posty na prośbę.
      </p>
      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => void opublikuj()} disabled={etap !== null}>
          {etap ?? "Opublikuj"}
        </Button>
        <Button
          variant="cichy"
          onClick={() => {
            setOtwarty(false);
            setPlik(null);
            setPodpis("");
            setBlad(null);
          }}
          disabled={etap !== null}
        >
          Anuluj
        </Button>
      </div>
    </section>
  );
}
