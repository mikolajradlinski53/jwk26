"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import { KROK_S, SWIAT, krok, nowyStan, type Stan } from "@/lib/kruk/fizyka";
import { rysuj, wczytajObrazy, type ObrazyGry, type Paleta } from "./rysuj";

type Faza = "czeka" | "leci" | "pauza" | "koniec";

/**
 * Najdłuższy odcinek czasu, jaki pętla przyjmuje naraz. Po powrocie z tła
 * pierwsza klatka niesie sekundy przerwy — bez przycięcia kruk by je przeskoczył.
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
export function Lot({ rekordPoczatkowy }: { rekordPoczatkowy: number | null }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [runda, setRunda] = useState(0);
  const [faza, setFaza] = useState<Faza>("czeka");
  const [wynik, setWynik] = useState(0);
  const [rekord, setRekord] = useState<number | null>(rekordPoczatkowy);
  const [uwaga, setUwaga] = useState<string | null>(null);
  const obrazyRef = useRef<ObrazyGry | null>(null);

  // Grafiki raz na wejście na ekran. Do czasu wczytania gra rysuje wersję
  // wektorową — słaba sieć niczego nie blokuje (spec wyglądu, „Kruk”). Osobny
  // efekt, bez `runda`: „Jeszcze raz” nie ciągnie grafik od nowa.
  useEffect(() => {
    let zyje = true;
    wczytajObrazy()
      .then((o) => {
        if (zyje) obrazyRef.current = o;
      })
      .catch((e) => console.error("Grafiki kruka się nie wczytały:", e));
    return () => {
      zyje = false;
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

    // Wyjście z apki w trakcie lotu — pauza. Nie pomaga oszukiwać: zegar bazy biegnie dalej.
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
    setUwaga(null);
    setRunda((r) => r + 1);
  }

  return (
    <div className="grid gap-3">
      {uwaga && (
        <p role="alert" className="text-center text-sm text-krew-jasna">
          {uwaga}
        </p>
      )}
      <div className="relative overflow-hidden rounded-md border border-white/10">
        <canvas
          ref={canvasRef}
          aria-label="Plansza lotu kruka — dotknij, żeby machnąć skrzydłami"
          className="block aspect-[3/4] w-full touch-none select-none"
        />
        {faza === "czeka" && <Napis>Dotknij, by lecieć</Napis>}
        {faza === "pauza" && <Napis>Pauza — dotknij, by lecieć dalej</Napis>}
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
