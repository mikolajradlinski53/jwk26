import Link from "next/link";
import { odliczanie } from "@/lib/odliczanie";
import { Zaba } from "@/components/Zaba";
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
      <Zaba stan="powitanie" className="size-24 text-jesien-mech" />

      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-jesien-kora">Jesienny Wyjazd Komisji</p>
        <h1 className="font-tytul text-4xl leading-none text-jesien-atrament">JWK26</h1>
      </div>

      <Licznik
        docelowa={dataJwk}
        etykieta="Do wyjazdu"
        poTerminie="Trwa"
        poczatkowe={odliczanie(dataJwk, new Date())}
      />

      <Link
        href="/wejscie"
        className="flex min-h-12 w-full items-center justify-center rounded-full border border-jesien-rdza/40
                   bg-jesien-rdza px-5 text-sm font-bold text-white
                   transition hover:brightness-110
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
      >
        Wejdź do Sekty
      </Link>
    </section>
  );
}
