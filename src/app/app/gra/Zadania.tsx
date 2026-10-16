"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikatZdjecia, wyslijZdjecieZadania } from "@/lib/zgloszenieZdjecia";
import { zdarzenie } from "@/lib/zdarzenia";
import { linkNawigacji } from "@/lib/mapy";
import { MapaQuestow, type Pinezka } from "./MapaQuestow";
import type { BingoSubmission, BingoTask } from "@/types/db";

type Stan = "do-zrobienia" | "czeka" | "zaliczone" | "odrzucone";

const ETYKIETA: Record<Stan, string> = {
  "do-zrobienia": "Do zrobienia",
  czeka: "Czeka na akceptację",
  zaliczone: "Zaliczone",
  odrzucone: "Odrzucone - spróbujcie jeszcze raz",
};

const KLASA: Record<Stan, string> = {
  "do-zrobienia": "text-dym",
  czeka: "text-kosc",
  zaliczone: "text-krew-jasna",
  odrzucone: "text-krew-jasna",
};

/** Stan zadania dla drużyny: żywe (nieodrzucone) zgłoszenie albo ostatnie odrzucone. */
export function stanZadania(zgloszenia: BingoSubmission[]): {
  stan: Stan;
  zywe?: BingoSubmission;
  odrzucone?: BingoSubmission;
} {
  const zywe = zgloszenia.find((s) => s.status !== "rejected");
  const odrzucone = zgloszenia
    .filter((s) => s.status === "rejected")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (zywe) return { stan: zywe.status === "approved" ? "zaliczone" : "czeka", zywe, odrzucone };
  return { stan: odrzucone ? "odrzucone" : "do-zrobienia", odrzucone };
}

export function Zadania({
  zadania,
  zgloszenia,
  userId,
  teamId,
  podglad = false,
}: {
  zadania: BingoTask[];
  zgloszenia: BingoSubmission[];
  userId: string;
  teamId: string;
  /** Organizator bez drużyny: same zadania, bez wysyłania. */
  podglad?: boolean;
}) {
  const [wybrane, setWybrane] = useState<string | null>(null);

  // Pinezki tylko dla zadań z miejscem. useMemo - mapa buduje się od nowa
  // wyłącznie przy nowych danych z serwera, nie przy każdym wyborze pinezki.
  const pinezki = useMemo<Pinezka[]>(
    () =>
      zadania
        .filter((z) => z.lat !== null && z.lng !== null)
        .map((z) => ({
          id: z.id,
          tytul: z.title,
          punkty: z.points,
          lat: z.lat as number,
          lng: z.lng as number,
          zaliczone: stanZadania(zgloszenia.filter((s) => s.task_id === z.id)).stan === "zaliczone",
        })),
    [zadania, zgloszenia],
  );

  const wybierz = useCallback((id: string) => {
    setWybrane(id);
    document.getElementById(`quest-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="grid gap-3">
      {pinezki.length > 0 && (
        <div className="grid gap-1.5">
          <MapaQuestow pinezki={pinezki} onWybierz={wybierz} />
          <p className="px-1 text-xs text-dym">
            Dotknij pinezki, żeby zobaczyć zadanie. Szare - już zaliczone przez Twoją drużynę.
          </p>
        </div>
      )}
      {podglad && (
        <p className="szklo rounded-md px-4 py-3 text-xs leading-relaxed text-dym">
          Podgląd Organizatora - tak drużyny widzą odkryte zadania. Zgłoszenia rozpatrujesz w panelu (Bingo).
        </p>
      )}
      {zadania.map((z) => (
        <Karta
          key={z.id}
          zadanie={z}
          {...stanZadania(zgloszenia.filter((s) => s.task_id === z.id))}
          userId={userId}
          teamId={teamId}
          podglad={podglad}
          wyrozniona={wybrane === z.id}
        />
      ))}
    </div>
  );
}

function Karta({
  zadanie,
  stan,
  zywe,
  odrzucone,
  userId,
  teamId,
  podglad,
  wyrozniona,
}: {
  podglad: boolean;
  wyrozniona: boolean;
  zadanie: BingoTask;
  stan: Stan;
  zywe?: BingoSubmission;
  odrzucone?: BingoSubmission;
  userId: string;
  teamId: string;
}) {
  const router = useRouter();
  const [plik, setPlik] = useState<File | null>(null);
  const [podpis, setPodpis] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [etap, setEtap] = useState<string | null>(null);
  const wToku = useRef(false);

  async function wyslij() {
    if (wToku.current) return;
    setBlad(null);
    if (!plik) {
      setBlad("Wybierz zdjęcie.");
      return;
    }
    wToku.current = true;
    try {
      await wyslijZdjecieZadania({ userId, teamId, taskId: zadanie.id, plik, podpis, etap: setEtap });
      zdarzenie("zdjecie_zadania", { rodzaj: "gra_terenowa" });
      setPlik(null);
      setPodpis("");
      router.refresh();
    } catch (e) {
      console.error("Zgłoszenie zadania gry terenowej nie przeszło:", e);
      setBlad(komunikatZdjecia(e, "To zadanie właśnie zgłosił ktoś z drużyny. Odśwież ekran."));
    } finally {
      setEtap(null);
      wToku.current = false;
    }
  }

  async function wycofaj(id: string) {
    if (wToku.current) return;
    wToku.current = true;
    setBlad(null);
    setEtap("Wycofuję...");
    const { error } = await createClient().from("bingo_submissions").delete().eq("id", id);
    setEtap(null);
    wToku.current = false;
    if (error) {
      console.error("Wycofanie zadania gry terenowej nie przeszło:", error);
      setBlad(komunikatZdjecia(error, "Odśwież ekran."));
      return;
    }
    router.refresh();
  }

  return (
    <article
      id={`quest-${zadanie.id}`}
      className={
        "szklo scroll-mt-24 rounded-md px-4 py-4 transition-shadow " +
        (wyrozniona ? "border-krew/70 shadow-[0_0_0_2px_rgb(200_16_46/0.55)]" : "")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-tytul text-lg leading-tight text-kosc">{zadanie.title}</h2>
        <span className="shrink-0 text-xs font-bold tabular-nums text-krew-jasna">{zadanie.points} pkt</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-kosc/85">{zadanie.description}</p>
      {zadanie.lat !== null && zadanie.lng !== null && (
        <a
          href={linkNawigacji({ lat: zadanie.lat, lng: zadanie.lng })}
          target="_blank"
          rel="noopener"
          data-zdarzenie="nawigacja"
          data-miejsce="gra_terenowa"
          className="szklo mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-bold text-kosc"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          Nawiguj w Google Maps
        </a>
      )}
      <p className={`mt-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] ${KLASA[stan]}`}>
        {ETYKIETA[stan]}
      </p>

      {stan === "odrzucone" && (
        <p className="mt-1 text-sm text-dym">{odrzucone?.review_note?.trim() || "Bez podania powodu."}</p>
      )}

      {!podglad && (stan === "do-zrobienia" || stan === "odrzucone") && (
        <div className="mt-3 grid gap-3">
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
              Opis
            </span>
            <textarea
              value={podpis}
              onChange={(e) => setPodpis(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Co zrobiliście?"
              className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none
                         placeholder:text-dym focus-visible:border-krew"
            />
          </label>
          {blad && (
            <p role="alert" className="text-sm text-krew-jasna">
              {blad}
            </p>
          )}
          <Button onClick={wyslij} disabled={etap !== null}>
            {etap ?? "Wyślij zgłoszenie drużyny"}
          </Button>
        </div>
      )}

      {stan === "czeka" && zywe?.user_id === userId && (
        <div className="mt-3 grid gap-2">
          {blad && (
            <p role="alert" className="text-sm text-krew-jasna">
              {blad}
            </p>
          )}
          <Button variant="szklo" onClick={() => wycofaj(zywe.id)} disabled={etap !== null}>
            {etap ?? "Wycofaj zgłoszenie"}
          </Button>
        </div>
      )}
      {stan === "czeka" && zywe?.user_id !== userId && (
        <p className="mt-1 text-sm text-dym">Ktoś z drużyny już to zgłosił.</p>
      )}
      {stan === "zaliczone" && <p className="mt-1 text-sm text-dym">{zadanie.points} pkt trafiło do drużyny.</p>}
    </article>
  );
}
