"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import { KROK_S, SWIAT, krok, nowyStan, type Stan } from "@/lib/kruk/fizyka";
import { rysuj, wczytajObrazy, type ObrazyGry, type Paleta } from "./rysuj";
import { zdarzenie } from "@/lib/zdarzenia";

type Faza = "czeka" | "leci" | "pauza" | "koniec";

/**
 * Najdłuższy odcinek czasu, jaki pętla przyjmuje naraz. Po powrocie z tła
 * pierwsza klatka niesie sekundy przerwy - bez przycięcia kruk by je przeskoczył.
 */
const MAKS_DT = 0.25;

/**
 * Kolory i krój z tokenów strony. Z `body`, nie z `html`: zmienna fontu z
 * next/font wisi na elemencie, na który nałożono jego klasę, a body ją dziedziczy.
 */
function paleta(): Paleta {
  const css = getComputedStyle(document.body);
  const v = (nazwa: string, zapas: string) => css.getPropertyValue(nazwa).trim() || zapas;
  return {
    noc: v("--color-noc", "#0c0709"),
    kosc: v("--color-kosc", "#f4eeeb"),
    dym: v("--color-dym", "#9c8b8e"),
    krew: v("--color-krew", "#c8102e"),
    font: v("--font-tytul", "serif"),
  };
}

function Napis({ children }: { children: React.ReactNode }) {
  return (
    <p className="pointer-events-none absolute inset-x-0 bottom-10 text-center text-sm uppercase tracking-[0.14em] text-kosc">
      {children}
    </p>
  );
}

/**
 * Plansza kruka. Cała gra żyje w efekcie: stan, pętla i obsługa dotyku są
 * zmiennymi domknięcia, a do Reacta wychodzi tylko to, co widać poza canvasem
 * (faza, wynik, rekord, komunikat). „Jeszcze raz" podbija `runda`, co stawia
 * efekt od nowa z czystym stanem.
 */
/** Rywale z rankingu - do paska „do pobicia” nad planszą. */
export type Rywal = { userId: string; nazwa: string; rekord: number };

/**
 * Pasek rywalizacji nad planszą (2026-10-15, „żeby ranking był widoczny
 * podczas grania”): lider, a w locie najbliższy wynik do pobicia, który
 * przeskakuje na kolejną osobę, gdy ją przegonisz.
 */
function PasekRywalizacji({
  rywale,
  userId,
  biezacy,
  wLocie,
  rekord,
}: {
  rywale: Rywal[];
  userId: string;
  biezacy: number;
  wLocie: boolean;
  rekord: number | null;
}) {
  const inni = rywale.filter((r) => r.userId !== userId);
  const lider = rywale[0];
  const doPobicia = inni.filter((r) => r.rekord > biezacy).sort((a, b) => a.rekord - b.rekord)[0];
  let prawa: string;
  if (wLocie) {
    if (doPobicia) prawa = `Do pobicia: ${doPobicia.nazwa} · ${doPobicia.rekord}`;
    else prawa = inni.length > 0 ? "Prowadzisz w rankingu!" : "Lecisz po pierwszy rekord";
  } else {
    prawa = rekord !== null ? `Twój rekord: ${rekord}` : "Jeszcze bez rekordu";
  }
  return (
    <div className="szklo flex items-center justify-between gap-3 rounded-md px-3.5 py-2 text-xs">
      <span className="min-w-0 truncate text-dym">
        {lider ? (
          <>
            Lider: <strong className="text-kosc">{lider.userId === userId ? "Ty" : lider.nazwa}</strong> · {lider.rekord}
          </>
        ) : (
          "Ranking pusty - bądź pierwszy"
        )}
      </span>
      <span
        aria-live="polite"
        className={`shrink-0 font-bold tabular-nums ${wLocie && !doPobicia && inni.length > 0 ? "text-krew-jasna" : "text-kosc"}`}
      >
        {prawa}
      </span>
    </div>
  );
}

export function Lot({
  rekordPoczatkowy,
  rywale = [],
  userId = "",
}: {
  rekordPoczatkowy: number | null;
  rywale?: Rywal[];
  userId?: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [runda, setRunda] = useState(0);
  const [faza, setFaza] = useState<Faza>("czeka");
  const [wynik, setWynik] = useState(0);
  // Wynik na żywo dla paska rywalizacji - zmienia się tylko przy przelocie
  // kolumny, więc nie przerysowuje Reacta co klatkę.
  const [naZywo, setNaZywo] = useState(0);
  const [rekord, setRekord] = useState<number | null>(rekordPoczatkowy);
  const [uwaga, setUwaga] = useState<string | null>(null);
  const obrazyRef = useRef<ObrazyGry | null>(null);
  // Czy można już grać: grafiki wczytane albo minął czas oczekiwania.
  // Ref dla pętli i dotyku (żyją w domknięciu efektu), stan dla nakładki.
  const gotowaRef = useRef(false);
  const [gotowa, setGotowa] = useState(false);

  // Grafiki raz na wejście na ekran; do tego czasu nakładka „Kruk nadlatuje”,
  // a nie wektorowy zastępca - wektor mignął i znikał, co wyglądało jak błąd
  // (uwaga Mikołaja). Jeśli grafiki nie dojdą w 8 s albo padną, gra rusza
  // w wersji wektorowej: słaba sieć nie może zablokować gry na zawsze.
  // Osobny efekt, bez `runda`: „Jeszcze raz” nie ciągnie grafik od nowa.
  useEffect(() => {
    let zyje = true;
    const uwolnij = () => {
      if (!zyje || gotowaRef.current) return;
      gotowaRef.current = true;
      setGotowa(true);
    };
    const limit = setTimeout(uwolnij, 8000);
    wczytajObrazy()
      .then((o) => {
        if (zyje) obrazyRef.current = o;
      })
      .catch((e) => console.error("Grafiki kruka się nie wczytały:", e))
      .finally(uwolnij);
    return () => {
      zyje = false;
      clearTimeout(limit);
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const kontekst = el.getContext("2d");
    if (!kontekst) return;
    const plotno: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = kontekst;

    const supabase = createClient();
    const kolory = paleta();

    let stan: Stan = nowyStan();
    let aktualna: Faza = "czeka";
    let machniecie = false;
    let gra: Promise<string | null> | null = null;
    let zapas = 0;
    let poprzedni = performance.now();
    let ramka = 0;
    let zyje = true;
    let ostatniWynik = 0;

    function ustaw(f: Faza) {
      aktualna = f;
      setFaza(f);
    }

    function dopasujRozmiar() {
      const dpr = window.devicePixelRatio || 1;
      const szer = plotno.clientWidth;
      plotno.width = Math.round(szer * dpr);
      plotno.height = Math.round(((szer * SWIAT.wys) / SWIAT.szer) * dpr);
      const skala = plotno.width / SWIAT.szer;
      ctx.setTransform(skala, 0, 0, skala, 0, 0);
    }

    // Start w tle, lot rusza od razu. Czas liczy baza od własnego startu,
    // więc opóźnienie sieci działa tylko na niekorzyść zgłaszającego.
    function wystartuj() {
      setUwaga(null);
      gra = Promise.resolve(supabase.rpc("kruk_start")).then(({ data, error }) => {
        if (error) {
          console.error("Start kruka nie przeszedł:", { code: error.code, message: error.message });
          if (zyje) setUwaga(`${komunikat(error)} Ten lot się nie zapisze.`);
          return null;
        }
        zdarzenie("gra", { gra: "kruk" });
        return data as string;
      });
    }

    async function zakoncz() {
      ustaw("koniec");
      const koncowy = stan.wynik;
      setWynik(koncowy);
      const id = await gra;
      if (!id || !zyje) return;
      const { data, error } = await supabase.rpc("kruk_wynik", { p_gra: id, p_wynik: koncowy });
      if (!zyje) return;
      if (error) {
        console.error("Wynik kruka nie przeszedł:", { code: error.code, message: error.message });
        setUwaga(komunikat(error));
        return;
      }
      setRekord(data as number);
      // Ranking pod planszą liczy serwer.
      router.refresh();
    }

    function dotkniecie() {
      // Przed wczytaniem grafik start byłby lotem w ciemno - nakładka mówi,
      // że trzeba chwilę poczekać.
      if (!gotowaRef.current) return;
      if (aktualna === "czeka") {
        wystartuj();
        ustaw("leci");
        machniecie = true;
      } else if (aktualna === "leci") {
        machniecie = true;
      } else if (aktualna === "pauza") {
        ustaw("leci");
      }
    }

    function naDotyk(e: PointerEvent) {
      e.preventDefault();
      dotkniecie();
    }

    function naKlawisz(e: KeyboardEvent) {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      // Na ekranie końca spacja należy do przycisku „Jeszcze raz".
      if (aktualna === "koniec") return;
      e.preventDefault();
      dotkniecie();
    }

    // Wyjście z apki w trakcie lotu - pauza. Nie pomaga oszukiwać: zegar bazy biegnie dalej.
    function naWidocznosc() {
      if (document.hidden && aktualna === "leci") ustaw("pauza");
    }

    function klatka(teraz: number) {
      const dt = Math.min((teraz - poprzedni) / 1000, MAKS_DT);
      poprzedni = teraz;
      if (aktualna === "leci") {
        zapas += dt;
        while (zapas >= KROK_S) {
          stan = krok(stan, KROK_S, machniecie);
          machniecie = false;
          if (stan.wynik !== ostatniWynik) {
            ostatniWynik = stan.wynik;
            setNaZywo(stan.wynik);
          }
          zapas -= KROK_S;
          if (stan.rozbity) {
            zapas = 0;
            void zakoncz();
            break;
          }
        }
      }
      rysuj(ctx, stan, kolory, {
        czas: teraz / 1000,
        unosi: aktualna === "czeka",
        pokazWynik: aktualna !== "czeka",
      }, obrazyRef.current);
      ramka = requestAnimationFrame(klatka);
    }

    dopasujRozmiar();
    plotno.addEventListener("pointerdown", naDotyk);
    window.addEventListener("keydown", naKlawisz);
    window.addEventListener("resize", dopasujRozmiar);
    document.addEventListener("visibilitychange", naWidocznosc);
    ramka = requestAnimationFrame(klatka);

    return () => {
      zyje = false;
      cancelAnimationFrame(ramka);
      plotno.removeEventListener("pointerdown", naDotyk);
      window.removeEventListener("keydown", naKlawisz);
      window.removeEventListener("resize", dopasujRozmiar);
      document.removeEventListener("visibilitychange", naWidocznosc);
    };
  }, [runda, router]);

  function jeszczeRaz() {
    setFaza("czeka");
    setWynik(0);
    setNaZywo(0);
    setUwaga(null);
    setRunda((r) => r + 1);
  }

  return (
    <div className="grid gap-3">
      <PasekRywalizacji
        rywale={rywale}
        userId={userId}
        biezacy={faza === "czeka" ? 0 : naZywo}
        wLocie={faza === "leci" || faza === "pauza"}
        rekord={rekord}
      />
      {uwaga && (
        <p role="alert" className="text-center text-sm text-krew-jasna">
          {uwaga}
        </p>
      )}
      <div className="relative overflow-hidden rounded-md border border-white/10">
        <canvas
          ref={canvasRef}
          aria-label="Plansza lotu kruka - dotknij, żeby machnąć skrzydłami"
          className="block aspect-[3/4] w-full touch-none select-none"
        />
        {!gotowa && (
          <div
            role="status"
            className="absolute inset-0 grid place-content-center justify-items-center gap-4 bg-noc text-center"
          >
            <span aria-hidden="true" className="size-9 animate-spin rounded-full border-2 border-white/15 border-t-kosc" />
            <p className="text-xs uppercase tracking-[0.14em] text-dym">Kruk nadlatuje…</p>
          </div>
        )}
        {gotowa && faza === "czeka" && <Napis>Dotknij, by lecieć</Napis>}
        {faza === "pauza" && <Napis>Pauza - dotknij, by lecieć dalej</Napis>}
        {faza === "koniec" && (
          <div className="absolute inset-0 grid place-content-center gap-4 bg-noc/70 px-8 text-center">
            <p className="font-tytul text-3xl tabular-nums text-kosc">Wynik {wynik}</p>
            {rekord !== null && (
              <p className="text-xs uppercase tracking-[0.14em] text-dym">Twój rekord: {rekord}</p>
            )}
            <Button onClick={jeszczeRaz}>Jeszcze raz</Button>
          </div>
        )}
      </div>
    </div>
  );
}
