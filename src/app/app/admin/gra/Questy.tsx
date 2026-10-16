"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { linkNawigacji } from "@/lib/mapy";
import { miejsceZLinku } from "./miejsce";

export type QuestAdmina = {
  id: string;
  title: string;
  description: string;
  points: number;
  odkryte: boolean;
  active: boolean;
  zgloszen: number;
  zaliczonych: number;
  lat: number | null;
  lng: number | null;
};

const ETYKIETA = "mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym";
const POLE_MIEJSCA =
  "szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none placeholder:text-dym focus-visible:border-krew";

export function Questy({ questy }: { questy: QuestAdmina[] }) {
  const router = useRouter();
  const [tytul, setTytul] = useState("");
  const [opis, setOpis] = useState("");
  const [punkty, setPunkty] = useState("50");
  const [miejsce, setMiejsce] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function akcja(opisAkcji: string, zapytanie: () => PromiseLike<{ error: { message: string } | null }>) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await zapytanie();
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${opisAkcji} nie przeszło:`, error);
      setBlad(`${opisAkcji} się nie udało. Odśwież i spróbuj jeszcze raz.`);
      return false;
    }
    router.refresh();
    return true;
  }

  async function dodaj() {
    const p = Number(punkty);
    if (!tytul.trim() || !opis.trim()) {
      setBlad("Podaj tytuł i opis zadania.");
      return;
    }
    if (!Number.isInteger(p) || p < 1 || p > 1000) {
      setBlad("Punkty to liczba od 1 do 1000.");
      return;
    }
    let gdzie: { lat: number; lng: number; link_mapy: string | null } | null = null;
    if (miejsce.trim()) {
      setCzeka(true);
      const m = await miejsceZLinku(miejsce);
      setCzeka(false);
      if ("blad" in m) {
        setBlad(m.blad);
        return;
      }
      gdzie = { ...m.punkt, link_mapy: m.link };
    }
    const ok = await akcja("Dodanie zadania", () =>
      createClient()
        .from("bingo_tasks")
        .insert({
          rodzaj: "quest",
          title: tytul.trim(),
          description: opis.trim(),
          points: p,
          odkryte: false,
          ...(gdzie ?? {}),
        }),
    );
    if (ok) {
      setTytul("");
      setOpis("");
      setMiejsce("");
    }
  }

  function odkryj(q: QuestAdmina) {
    if (!q.odkryte && !window.confirm(`Odkryć „${q.title}”? Wszyscy uczestnicy dostaną powiadomienie.`)) return;
    void akcja(q.odkryte ? "Ukrycie zadania" : "Odkrycie zadania", () =>
      createClient().from("bingo_tasks").update({ odkryte: !q.odkryte }).eq("id", q.id),
    );
  }

  function usun(q: QuestAdmina) {
    if (!window.confirm(`Usunąć „${q.title}”?`)) return;
    void akcja("Usunięcie zadania", () => createClient().from("bingo_tasks").delete().eq("id", q.id));
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="text-sm font-bold">Nowe zadanie</h2>
        <p className="text-xs leading-relaxed text-dym">
          Zadanie dodaje się jako ukryte. Odkryj je, kiedy ma ruszyć - wszyscy dostaną powiadomienie,
          a drużyny mogą wysłać po jednym zgłoszeniu (zdjęcie + opis). Zgłoszenia rozpatrujesz w kolejce Bingo.
        </p>
        <Field label="Tytuł" value={tytul} maxLength={80} onChange={(e) => setTytul(e.target.value)} />
        <label className="block">
          <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
            Opis - co drużyna ma zrobić i pokazać na zdjęciu
          </span>
          <textarea
            value={opis}
            onChange={(e) => setOpis(e.target.value.slice(0, 500))}
            rows={3}
            className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none focus-visible:border-krew"
          />
        </label>
        <Field label="Punkty dla drużyny" type="number" inputMode="numeric" min={1} max={1000} value={punkty} onChange={(e) => setPunkty(e.target.value)} />
        <label className="block">
          <span className={ETYKIETA}>Miejsce na mapie (opcjonalnie)</span>
          <input
            value={miejsce}
            onChange={(e) => setMiejsce(e.target.value)}
            placeholder="Link z Map Google albo 50.7781, 15.7563"
            className={POLE_MIEJSCA}
          />
          <span className="mt-1 block pl-0.5 text-xs leading-relaxed text-dym">
            W Mapach Google: miejsce → Udostępnij → Kopiuj link. Drużyny zobaczą pinezkę i nawigację.
          </span>
        </label>
        {blad && (
          <p role="alert" className="text-sm text-krew-jasna">
            {blad}
          </p>
        )}
        <Button onClick={dodaj} disabled={czeka}>
          {czeka ? "Zapisuję..." : "Dodaj zadanie (ukryte)"}
        </Button>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-bold">Zadania ({questy.length})</h2>
        {questy.length === 0 && <p className="text-sm text-dym">Jeszcze żadnego.</p>}
        {questy.map((q) => (
          <article key={q.id} className="szklo rounded-md px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-tytul text-lg leading-tight text-kosc">{q.title}</h3>
              <span className="shrink-0 text-xs font-bold tabular-nums text-krew-jasna">{q.points} pkt</span>
            </div>
            <p className="mt-1 text-sm text-kosc/85">{q.description}</p>
            <p className="mt-2 text-xs text-dym">
              {q.odkryte ? "Odkryte" : "Ukryte"} · zgłoszeń {q.zgloszen}, zaliczonych {q.zaliczonych}
            </p>
            <MiejsceQuestu quest={q} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant={q.odkryte ? "szklo" : "krew"} onClick={() => odkryj(q)} disabled={czeka}>
                {q.odkryte ? "Ukryj" : "Odkryj"}
              </Button>
              {/* Usunięcie skasowałoby zgłoszenia drużyn i ich wpisy w feedzie -
                  zadanie ze zgłoszeniami można tylko ukryć. */}
              <Button variant="cichy" onClick={() => usun(q)} disabled={czeka || q.zgloszen > 0}>
                Usuń
              </Button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

/** Miejsce zadania: podgląd w Mapach Google i zmiana przez wklejenie linku. */
function MiejsceQuestu({ quest }: { quest: QuestAdmina }) {
  const router = useRouter();
  const [edycja, setEdycja] = useState(false);
  const [tekst, setTekst] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);

  async function zapisz(wyczysc = false) {
    setBlad(null);
    setCzeka(true);
    let zmiana: { lat: number | null; lng: number | null; link_mapy: string | null } = {
      lat: null,
      lng: null,
      link_mapy: null,
    };
    if (!wyczysc) {
      const m = await miejsceZLinku(tekst);
      if ("blad" in m) {
        setCzeka(false);
        setBlad(m.blad);
        return;
      }
      zmiana = { ...m.punkt, link_mapy: m.link };
    }
    const { error } = await createClient().from("bingo_tasks").update(zmiana).eq("id", quest.id);
    setCzeka(false);
    if (error) {
      console.error("Zapis miejsca zadania nie przeszedł:", error);
      setBlad("Zapis miejsca się nie udał. Odśwież i spróbuj jeszcze raz.");
      return;
    }
    setEdycja(false);
    setTekst("");
    router.refresh();
  }

  return (
    <div className="mt-2 grid gap-2">
      <p className="text-xs text-dym">
        {quest.lat !== null && quest.lng !== null ? (
          <>
            Miejsce:{" "}
            <a
              href={linkNawigacji({ lat: quest.lat, lng: quest.lng })}
              target="_blank"
              rel="noopener"
              className="text-kosc underline underline-offset-2"
            >
              {quest.lat.toFixed(5)}, {quest.lng.toFixed(5)}
            </a>
          </>
        ) : (
          "Bez miejsca na mapie"
        )}
        {" · "}
        <button type="button" onClick={() => setEdycja((e) => !e)} className="font-bold text-krew-jasna">
          {edycja ? "Zamknij" : quest.lat !== null ? "Zmień" : "Ustaw"}
        </button>
      </p>
      {edycja && (
        <div className="grid gap-2">
          <input
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder="Link z Map Google albo 50.7781, 15.7563"
            className={POLE_MIEJSCA}
          />
          {blad && (
            <p role="alert" className="text-xs leading-relaxed text-krew-jasna">
              {blad}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void zapisz()} disabled={czeka || !tekst.trim()}>
              {czeka ? "Sprawdzam..." : "Zapisz miejsce"}
            </Button>
            <Button variant="cichy" onClick={() => void zapisz(true)} disabled={czeka || quest.lat === null}>
              Usuń miejsce
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
