import Link from "next/link";
import { ustawienia } from "@/lib/ustawienia";
import { odliczanie } from "@/lib/odliczanie";
import { Naglowek } from "./landing/Naglowek";
import { Wejscie } from "./landing/Wejscie";
import { Opis } from "./landing/Opis";
import { Promocja } from "./landing/Promocja";
import { KiedyGdzie } from "./landing/KiedyGdzie";
import { Licznik } from "./landing/Licznik";
import { Liscie } from "./landing/Liscie";
import { Stopka } from "./landing/Stopka";

/**
 * Landing wydarzenia. Publiczny, bez zamka instalacji — to jedyna trasa,
 * którą ktoś ma otworzyć z Instagrama, zanim cokolwiek zainstaluje.
 *
 * Awaria odczytu `ustawienia()` nie wywraca strony: liczniki i miejsce
 * po prostu nie pokażą danych, zamiast strona miała zniknąć.
 */
export default async function Landing() {
  const { dataJwk, dataSwiezakow, miejsceNazwa, miejsceAdres } = await ustawienia();

  return (
    <div className="jesien relative">
      {/*
        Liście pod treścią, nad tłem: `Liscie` maluje na `fixed inset-0 z-0`,
        a opakowanie treści poniżej dostaje `relative z-10`, żeby zawsze
        wygrywało w kolejności malowania niezależnie od kolejności w DOM.
      */}
      <Liscie />

      <div className="relative z-10">
        <Naglowek />
        <Wejscie dataJwk={dataJwk} />
        <Opis />
        <Promocja />
        <KiedyGdzie miejsceNazwa={miejsceNazwa} miejsceAdres={miejsceAdres} />

        <section className="mx-auto w-full max-w-md px-4 py-10">
          <h2 className="font-tytul text-xl text-jesien-atrament">Przyjęcie świeżaków</h2>
          <p className="mt-3 text-sm leading-relaxed text-jesien-kora">
            Tydzień przed wyjazdem przyjmujemy nowych członków Samorządu —
            osobny, krótszy rytuał wtajemniczenia.
          </p>
          <div className="mt-4">
            <Licznik
              docelowa={dataSwiezakow}
              etykieta="Do przyjęcia świeżaków"
              poTerminie="Zakończone"
              poczatkowe={odliczanie(dataSwiezakow, new Date())}
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-md px-4 py-10">
          <h2 className="font-tytul text-xl text-jesien-atrament">Regulamin</h2>
          <p className="mt-3 text-sm leading-relaxed text-jesien-kora">
            Kto może jechać, jak wygląda zgłoszenie i czego się od Ciebie
            oczekuje na miejscu — spisane osobno, żeby dało się to zlinkować.
          </p>
          <Link
            href="/regulamin"
            className="mt-3 inline-block text-sm font-bold text-jesien-rdza underline underline-offset-2"
          >
            Przeczytaj regulamin
          </Link>
        </section>

        <Stopka />
      </div>
    </div>
  );
}
