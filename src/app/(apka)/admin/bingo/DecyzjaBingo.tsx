"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// Komunikat, którym `review_bingo` odpowiada, gdy zgłoszenie zniknęło spod
// ręki — bo drugi admin (projekt świadomie dopuszcza równoległą pracę) zdążył
// je rozpatrzyć pierwszy. To normalna sytuacja, nie usterka.
const JUZ_ROZPATRZONE = /nie istnieje albo zostalo juz rozpatrzone/i;

export function DecyzjaBingo({ zgloszenieId }: { zgloszenieId: string }) {
  const router = useRouter();
  const [notatka, setNotatka] = useState("");
  const [czeka, setCzeka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [wyscigniety, setWyscigniety] = useState(false);

  // Ten sam rygiel co w `PrzyciskiDecyzji.tsx`: musi stać PRZED pierwszym
  // `await`, bo `czeka` odczytane w domknięciu bywa nieaktualne w oknie
  // krótszym niż jeden render.
  const wToku = useRef(false);

  async function rozpatrz(akceptuj: boolean) {
    if (wToku.current) return;
    wToku.current = true;
    setBlad(null);
    setCzeka(true);

    const { error } = await createClient().rpc("review_bingo", {
      p_submission_id: zgloszenieId,
      p_approve: akceptuj,
      p_note: notatka.trim() || null,
    });

    if (error) {
      console.error("Rozpatrzenie zgłoszenia bingo nie przeszło:", error);

      if (JUZ_ROZPATRZONE.test(error.message)) {
        // Dwóch adminów pracuje równocześnie — to założenie projektu.
        // Wiersz i tak zniknie z listy po odświeżeniu (przestał być
        // `pending`); dajemy chwilę, żeby komunikat zdążył się przeczytać,
        // zanim serwer podmieni kolejkę pod nogami.
        setWyscigniety(true);
        setTimeout(() => router.refresh(), 1500);
        return;
      }

      // Surowy komunikat z `raise exception` trafia na ekran wprost — admin
      // zna projekt, treść wyjątku jest dla niego informacją, nie szumem.
      setBlad(error.message);
      setCzeka(false);
      wToku.current = false;
      return;
    }

    // Akceptacja mogła po drodze dopisać bonus za linię albo pełną planszę —
    // ile dokładnie, wie tylko baza. Nie zgadujemy tu żadnej liczby.
    router.refresh();
  }

  if (wyscigniety) {
    return (
      <p className="mt-4 text-sm text-dym" role="status">
        Ktoś inny z ekipy admina już to rozpatrzył. Znika z kolejki...
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      <label className="block">
        <span className="mb-1.5 block font-tytul text-xs uppercase tracking-widest text-dym">
          Notatka
        </span>
        <input
          value={notatka}
          onChange={(e) => setNotatka(e.target.value)}
          placeholder="Widoczna dla uczestnika, zwłaszcza przy odrzuceniu"
          disabled={czeka}
          className="szklo min-h-11 w-full rounded-sm px-3
                     text-kosc outline-none placeholder:text-dym/70
                     focus-visible:border-krew disabled:opacity-60"
        />
      </label>

      {blad && <p className="text-sm text-krew-jasna">{blad}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => rozpatrz(true)} disabled={czeka}>
          Przyjmij
        </Button>
        <Button variant="szklo" onClick={() => rozpatrz(false)} disabled={czeka}>
          Odrzuć
        </Button>
      </div>
    </div>
  );
}
