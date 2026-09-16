"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { Button } from "@/components/ui/Button";
import type { BingoSubmission, BingoTask } from "@/types/db";

type Stan = "puste" | "oczekujace" | "zapalone";

/**
 * Tłumaczy błąd techniczny na zdanie, z którym uczestnik ma co zrobić.
 * Ten sam pomysł co w formularzu rejestracyjnym — surowy komunikat Postgresa
 * na telefonie, po ciemku, nikomu nie pomaga.
 */
function komunikat(e: unknown): string {
  const tekst = e instanceof Error ? e.message : String(e);

  if (/bingo_jedno_na_pole|duplicate key/i.test(tekst)) {
    return "To pole właśnie zajął ktoś z drużyny. Odśwież planszę.";
  }
  if (/row-level security|jwt|expired|401/i.test(tekst)) {
    return "Sesja wygasła. Zaloguj się ponownie.";
  }
  if (/mime type|not supported/i.test(tekst)) {
    return "Ten format zdjęcia nie przechodzi. Spróbuj innego pliku.";
  }
  if (/failed to fetch|networkerror|network/i.test(tekst)) {
    return "Zerwało połączenie. Sprawdź zasięg i spróbuj jeszcze raz.";
  }
  if (/image|decode|canvas|load/i.test(tekst)) {
    return "Nie udało się odczytać tego pliku jako zdjęcia. Spróbuj innego.";
  }
  return "Coś poszło nie tak. Spróbuj jeszcze raz.";
}

function stanPola(zgloszenie: BingoSubmission | undefined): Stan {
  if (!zgloszenie) return "puste";
  return zgloszenie.status === "approved" ? "zapalone" : "oczekujace";
}

// Stan pola NIE może wynikać wyłącznie z koloru (obramowanie w kolorze krwi
// bywa nieodróżnialne od wypełnienia dla daltonisty) — stąd trzy różne kształty
// ikon obok trzech różnych klas tła/obramowania.
function Ikona({ stan }: { stan: Stan }) {
  if (stan === "zapalone") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-3.5 shrink-0"
      >
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    );
  }
  if (stan === "oczekujace") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-3.5 shrink-0"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4.3l3 2" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className="size-3.5 shrink-0"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const KLASY_STANU: Record<Stan, string> = {
  puste: "szklo text-dym hover:bg-white/12",
  oczekujace: "border-2 border-krew bg-transparent text-kosc",
  zapalone:
    "border border-white/20 bg-gradient-to-b from-krew/90 to-krew-glab/90 text-white " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
};

function opisStanu(stan: Stan, wlasne: boolean): string {
  if (stan === "zapalone") return "zaliczone";
  if (stan === "oczekujace") {
    return wlasne ? "twoje zgłoszenie czeka na akceptację" : "czeka na akceptację";
  }
  return "puste, dotknij, by wrzucić zdjęcie";
}

export function Plansza({
  zadania,
  zgloszenia,
  userId,
  teamId,
}: {
  zadania: BingoTask[];
  zgloszenia: BingoSubmission[];
  userId: string;
  teamId: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [otwarteId, setOtwarteId] = useState<string | null>(null);
  const [plik, setPlik] = useState<File | null>(null);
  const [podpis, setPodpis] = useState("");
  const [etap, setEtap] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  // Rygiel niezależny od stanu Reacta — musi stać PRZED pierwszym `await`,
  // bo `etap` odczytane w domknięciu bywa nieaktualne w oknie krótszym niż
  // jeden render (dokładnie ten błąd kosztował nas czas przy rejestracji).
  const wToku = useRef(false);

  // Najwyżej jedno nieodrzucone zgłoszenie na zadanie i drużynę pilnuje tego
  // unikalny indeks w bazie — odrzucone świadomie pomijamy, bo zwalniają pole.
  const zgloszeniaByTask = useMemo(() => {
    const mapa = new Map<string, BingoSubmission>();
    for (const z of zgloszenia) {
      if (z.status !== "rejected") mapa.set(z.task_id, z);
    }
    return mapa;
  }, [zgloszenia]);

  const otwarty = zadania.find((z) => z.id === otwarteId) ?? null;
  const zgloszenieOtwartego = otwarty ? zgloszeniaByTask.get(otwarty.id) : undefined;
  const stanOtwartego = stanPola(zgloszenieOtwartego);
  const wlasneOtwarte = zgloszenieOtwartego?.user_id === userId;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (otwarty && !dialog.open) {
      dialog.showModal();
    } else if (!otwarty && dialog.open) {
      dialog.close();
    }
  }, [otwarty]);

  function zamknij() {
    dialogRef.current?.close();
  }

  async function wrzuc(task: BingoTask) {
    if (wToku.current) return;
    setBlad(null);

    if (!plik) {
      setBlad("Wybierz zdjęcie.");
      return;
    }

    wToku.current = true;
    setEtap("Przygotowuję zdjęcie...");

    try {
      const supabase = createClient();
      const zmniejszone = await skompresuj(plik);

      setEtap("Wysyłam zdjęcie...");
      const sciezka = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: bladUploadu } = await supabase.storage
        .from("bingo")
        .upload(sciezka, zmniejszone, { contentType: "image/jpeg" });
      if (bladUploadu) throw bladUploadu;

      setEtap("Zapisuję zgłoszenie...");
      const { error: bladZgloszenia } = await supabase.from("bingo_submissions").insert({
        team_id: teamId,
        user_id: userId,
        task_id: task.id,
        photo_path: sciezka,
        caption: podpis.trim() || null,
      });
      if (bladZgloszenia) throw bladZgloszenia;

      router.refresh();
      zamknij();
    } catch (e) {
      console.error("Zgłoszenie bingo nie przeszło:", e);
      setBlad(komunikat(e));
      setEtap(null);
      wToku.current = false;
    }
  }

  async function wycofaj(zgloszenieId: string) {
    if (wToku.current) return;
    wToku.current = true;
    setBlad(null);
    setEtap("Wycofuję zgłoszenie...");

    try {
      const supabase = createClient();
      const { error } = await supabase.from("bingo_submissions").delete().eq("id", zgloszenieId);
      if (error) throw error;

      router.refresh();
      zamknij();
    } catch (e) {
      console.error("Wycofanie zgłoszenia bingo nie przeszło:", e);
      setBlad(komunikat(e));
      setEtap(null);
      wToku.current = false;
    }
  }

  return (
    <>
      {/* Umieszczenie po `position`, nie po kolejności w tablicy: admin może
          strojenie zrobić dziurawym (zadanie nieaktywne, brakujący wiersz),
          a linie bonusowe (wiersze/kolumny/przekątne) zależą od tego, gdzie
          pole naprawdę stoi, nie od tego, które z kolei przyszło z bazy. */}
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Plansza bingo">
        {zadania.map((task) => {
          const zgloszenie = zgloszeniaByTask.get(task.id);
          const stan = stanPola(zgloszenie);
          const wlasne = zgloszenie?.user_id === userId;

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => setOtwarteId(task.id)}
              style={{
                gridColumn: (task.position % 5) + 1,
                gridRow: Math.floor(task.position / 5) + 1,
              }}
              aria-label={`${task.title} — ${opisStanu(stan, wlasne)}`}
              className={
                "flex aspect-square min-h-11 min-w-11 flex-col items-center justify-center gap-1 " +
                "rounded-sm p-1 text-center transition-colors " +
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew " +
                KLASY_STANU[stan]
              }
            >
              <Ikona stan={stan} />
              <span className="line-clamp-3 text-[0.55rem] font-bold uppercase leading-[1.15] tracking-wide">
                {task.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dialog rozpięty na cały ekran (tło samo w sobie jest przyciemnieniem),
          panel przyklejony do dołu przez flex — dzięki temu kliknięcie w tło
          trafia bezpośrednio w element dialogu, bez sztuczek z ::backdrop.
          Klawisz Escape zamyka natywnie i odpala `onClose` poniżej. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="bingo-arkusz-tytul"
        onClose={() => {
          setOtwarteId(null);
          setPlik(null);
          setPodpis("");
          setBlad(null);
          setEtap(null);
          wToku.current = false;
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) zamknij();
        }}
        className="fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-end
                   justify-center border-0 bg-noc/80 p-0 backdrop-blur-sm"
      >
        {otwarty && (
          <div
            className="szklo max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-lg p-5
                       pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="bingo-arkusz-tytul" className="font-tytul text-xl text-kosc">
                  {otwarty.title}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-widest text-dym">
                  {otwarty.points} pkt
                </p>
              </div>
              <button
                type="button"
                onClick={zamknij}
                aria-label="Zamknij"
                className="grid size-11 shrink-0 place-items-center rounded-full text-dym
                           hover:text-kosc focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-krew"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="size-5"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-kosc">{otwarty.description}</p>

            {stanOtwartego === "puste" && (
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
                    Zdjęcie
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      setPlik(e.target.files?.[0] ?? null);
                      setBlad(null);
                    }}
                    className="block w-full text-sm text-dym
                               file:mr-3 file:min-h-11 file:rounded-full file:border-0
                               file:bg-krew file:px-4 file:text-xs file:font-bold file:text-white"
                  />
                  {plik && (
                    <span className="mt-1.5 block text-sm text-dym">
                      {plik.name} ({Math.round(plik.size / 1024)} kB)
                    </span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
                    Podpis (opcjonalnie)
                  </span>
                  <input
                    value={podpis}
                    onChange={(e) => setPodpis(e.target.value.slice(0, 300))}
                    placeholder="Coś do powiedzenia?"
                    className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none
                               placeholder:text-dym/70 focus-visible:border-krew"
                  />
                </label>

                {blad && <p className="text-sm text-krew-jasna">{blad}</p>}

                <Button onClick={() => wrzuc(otwarty)} disabled={etap !== null}>
                  {etap ?? "Wrzuć zdjęcie"}
                </Button>
              </div>
            )}

            {stanOtwartego === "oczekujace" && wlasneOtwarte && zgloszenieOtwartego && (
              <div className="grid gap-3">
                <p className="text-sm text-dym">Twoje zgłoszenie czeka na akceptację.</p>
                {blad && <p className="text-sm text-krew-jasna">{blad}</p>}
                <Button
                  variant="szklo"
                  onClick={() => wycofaj(zgloszenieOtwartego.id)}
                  disabled={etap !== null}
                >
                  {etap ?? "Wycofaj zgłoszenie"}
                </Button>
              </div>
            )}

            {stanOtwartego === "oczekujace" && !wlasneOtwarte && (
              <p className="text-sm text-dym">
                Ktoś z drużyny już to zgłosił. Czeka na akceptację.
              </p>
            )}

            {stanOtwartego === "zapalone" && (
              <p className="text-sm text-dym">
                Zaliczone — {otwarty.points} pkt trafiło już do drużyny.
              </p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
