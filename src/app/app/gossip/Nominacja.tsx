"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";
import type { Kandydat } from "@/lib/gossipy";

const ETYKIETA = "mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym";

/**
 * Nominacja w jednej kategorii: kogo, dlaczego i - jeśli chcesz - zdjęcie.
 * Lista kandydatów przychodzi już bez pytającego, więc siebie nie da się
 * nawet zaznaczyć.
 *
 * Zdjęcie ląduje pod `<kategoria>/<losowy uuid>.jpg`: ścieżka trafia potem do
 * przeglądarek innych osób i nie może zdradzać autora. Kompresja przerysowuje
 * obraz, więc przy okazji znika EXIF (z miejscem zrobienia zdjęcia).
 */
export function Nominacja({
  kategoria,
  kandydaci,
  minimum,
}: {
  kategoria: string;
  kandydaci: Kandydat[];
  minimum: number;
}) {
  const router = useRouter();
  const [wybor, setWybor] = useState<string | null>(null);
  const [szukaj, setSzukaj] = useState("");
  const [tekst, setTekst] = useState("");
  const [plik, setPlik] = useState<File | null>(null);
  const [podglad, setPodglad] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [etap, setEtap] = useState<string | null>(null);
  const wToku = useRef(false);
  const inputPliku = useRef<HTMLInputElement>(null);

  const dlugosc = tekst.trim().length;
  const fraza = szukaj.trim().toLowerCase();
  const widoczni = fraza ? kandydaci.filter((k) => k.nazwa.toLowerCase().includes(fraza)) : kandydaci;
  const wybrany = kandydaci.find((k) => k.id === wybor);

  // Adres podglądu zwalniany przy zmianie zdjęcia i przy odmontowaniu -
  // bez tego każdy wybór trzyma cały plik w pamięci do zamknięcia karty.
  useEffect(() => {
    return () => {
      if (podglad) URL.revokeObjectURL(podglad);
    };
  }, [podglad]);

  function ustawZdjecie(nowy: File | null) {
    setPlik(nowy);
    setPodglad(nowy ? URL.createObjectURL(nowy) : null);
    if (!nowy && inputPliku.current) inputPliku.current.value = "";
  }

  async function wyslij() {
    if (wToku.current) return;
    setBlad(null);
    if (!wybor) {
      setBlad("Wybierz osobę");
      return;
    }
    if (dlugosc < minimum) {
      setBlad(`Uzasadnienie musi mieć co najmniej ${minimum} znaków - brakuje ${minimum - dlugosc}.`);
      return;
    }

    wToku.current = true;
    const supabase = createClient();
    try {
      let sciezka: string | null = null;
      if (plik) {
        setEtap("Przygotowuję zdjęcie…");
        const male = await skompresuj(plik);
        setEtap("Wysyłam zdjęcie…");
        sciezka = `${kategoria}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("gossip")
          .upload(sciezka, male, { contentType: "image/jpeg" });
        if (error) throw error;
      }

      setEtap("Zapisuję nominację…");
      const { error } = await supabase.rpc("oddaj_glos", {
        p_kategoria: kategoria,
        p_nominowany: wybor,
        p_uzasadnienie: tekst.trim(),
        p_zdjecie: sciezka,
      });
      if (error) throw error;
      router.refresh();
    } catch (e) {
      console.error("Nominacja nie przeszła:", e);
      setBlad(komunikat(e));
      setEtap(null);
      wToku.current = false;
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <span className={ETYKIETA}>Kogo nominujesz?</span>
        {wybrany ? (
          <div className="szklo flex min-h-12 items-center justify-between gap-3 rounded-sm px-3.5 py-2">
            <strong className="min-w-0 truncate text-sm text-kosc">{wybrany.nazwa}</strong>
            <button
              type="button"
              onClick={() => setWybor(null)}
              className="min-h-11 flex-none px-2 text-xs text-dym underline underline-offset-2"
            >
              Zmień
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <input
              type="search"
              value={szukaj}
              onChange={(e) => setSzukaj(e.target.value)}
              placeholder="Szukaj po nazwie w apce"
              aria-label="Szukaj osoby"
              className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none placeholder:text-dym focus-visible:border-krew"
            />
            <ul className="grid max-h-60 gap-0.5 overflow-y-auto overscroll-contain rounded-sm">
              {widoczni.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => setWybor(k.id)}
                    className="flex min-h-11 w-full items-center rounded-sm px-2 text-left text-sm text-kosc hover:bg-white/8"
                  >
                    {k.nazwa}
                  </button>
                </li>
              ))}
              {widoczni.length === 0 && <li className="px-2 py-2 text-sm text-dym">Nikogo takiego.</li>}
            </ul>
          </div>
        )}
      </div>

      <label className="block">
        <span className={ETYKIETA}>Dlaczego? (anonimowo)</span>
        <textarea
          rows={5}
          maxLength={2000}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none placeholder:text-dym focus-visible:border-krew"
          placeholder="Napisz konkret - historię, cytat, moment z wyjazdu."
        />
        <span
          className={`mt-1 block text-right text-xs tabular-nums ${dlugosc >= minimum ? "text-dym" : "text-krew-jasna"}`}
          aria-live="polite"
        >
          {dlugosc} / {minimum}
        </span>
      </label>

      <div>
        <span className={ETYKIETA}>Zdjęcie (opcjonalnie)</span>
        {podglad ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- lokalny blob, nie ma czego optymalizować */}
            <img src={podglad} alt="Wybrane zdjęcie" className="size-20 rounded-sm object-cover" />
            <button
              type="button"
              onClick={() => ustawZdjecie(null)}
              className="min-h-11 px-2 text-xs text-dym underline underline-offset-2"
            >
              Usuń zdjęcie
            </button>
          </div>
        ) : (
          <input
            ref={inputPliku}
            type="file"
            accept="image/*"
            onChange={(e) => ustawZdjecie(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-dym file:mr-3 file:min-h-11 file:rounded-full file:border file:border-white/20
                       file:bg-transparent file:px-4 file:text-xs file:font-bold file:text-kosc"
          />
        )}
      </div>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      <Button onClick={() => void wyslij()} disabled={etap !== null}>
        {etap ?? "Nominuj"}
      </Button>
      <p className="text-xs leading-relaxed text-dym">
        Nominujesz raz i nie da się tego zmienić. Nikt poza organizatorami nie zobaczy, kto co
        napisał - po ujawnieniu pokażemy tylko uzasadnienia i zdjęcia o zwycięzcy. Zdjęcie nie może
        nikogo ośmieszać ani pokazywać osób, które nie chcą być fotografowane (regulamin, § 19).
      </p>
    </div>
  );
}
