import Link from "next/link";
import { odliczanie } from "@/lib/odliczanie";
import { Licznik } from "./Licznik";

/**
 * Sekcja wejściowa — pierwsze, co widać po otwarciu landingu.
 *
 * Musi być czytelna w pierwszej klatce: żadnej sekcji na `100vh`, która
 * wypychałaby licznik i przycisk poza pierwszy kadr, żadnego `opacity: 0`
 * czekającego na obserwatora przewijania. Stąd też licznik dostaje
 * `poczatkowe` policzone tutaj, na serwerze — bez tego pokazywałby kreskę,
 * dopóki nie doładuje się JavaScript, a to promocja idąca przez Instagram,
 * czyli trafia też do ludzi na słabym łączu.
 */
export function Wejscie({ dataJwk }: { dataJwk: string | null }) {
  return (
    <section className="mx-auto grid w-full max-w-md justify-items-center gap-6 px-4 pb-12 pt-10 text-center">
      {/*
        Gniazdo na maskotkę. Task 9 wstawia tu `<Zaba stan="powitanie" />`.
        Rozmiar zarezerwowany już teraz, żeby wejście grafiki nie przesunęło
        reszty sekcji o wysokość, na którą nikt się nie przygotował.
      */}
      <div className="size-24" aria-hidden="true" />

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-dym">Jesienny Wyjazd Komisji</p>
        <h1 className="font-tytul text-4xl leading-none text-kosc">JWK26</h1>
      </div>

      <Licznik
        docelowa={dataJwk}
        etykieta="Do wyjazdu"
        poTerminie="Trwa"
        poczatkowe={odliczanie(dataJwk, new Date())}
      />

      <Link
        href="/wejscie"
        className="flex min-h-12 w-full items-center justify-center rounded-full border border-white/20
                   bg-gradient-to-b from-krew/90 to-krew-glab/90 px-5 text-sm font-bold text-white
                   shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_26px_rgb(200_16_46/0.32)]
                   backdrop-blur-md transition hover:brightness-110
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
      >
        Wejdź do Sekty
      </Link>
    </section>
  );
}
