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
import { SekcjaNaglowek } from "./landing/SekcjaNaglowek";
import { DzielnikFala, DzielnikSzewron, DzielnikSkos, DzielnikLisc } from "./landing/Dzielniki";
import { Kontener } from "./landing/Kontener";

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

        {/*
          Fala wypływająca z ciemnego dołu zdjęcia hero w jasną sekcję —
          nosiciel dzielnika maluje się na `bg-noc`, ten sam odcień co dół
          gradientu `.hero-przyciemnienie`, żeby przejście było ciągłe.
        */}
        <DzielnikFala kolorKlasa="text-jesien-tlo" tloKlasa="bg-noc" />

        <Opis />
        <DzielnikSzewron />
        <Promocja />
        <DzielnikSkos kolorKlasa="bg-jesien-tlo" tloKlasa="bg-jesien-karta" />
        <KiedyGdzie miejsceNazwa={miejsceNazwa} miejsceAdres={miejsceAdres} />
        <DzielnikLisc />

        <section className="bg-jesien-karta mx-auto w-full px-4 py-14">
          <Kontener>
            <SekcjaNaglowek numer="04" nadtytul="Rekrutacja" tytul="Przyjęcie świeżaków" />
            <p className="text-sm leading-relaxed text-jesien-kora">
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
          </Kontener>
        </section>

        <DzielnikSzewron />

        <section className="bg-jesien-tlo mx-auto w-full px-4 py-14">
          <Kontener>
            <SekcjaNaglowek numer="05" nadtytul="Zasady" tytul="Regulamin" />
            <p className="text-sm leading-relaxed text-jesien-kora">
              Kto może jechać, jak wygląda zgłoszenie i czego się od Ciebie
              oczekuje na miejscu — spisane osobno, żeby dało się to zlinkować.
            </p>
            <Link
              href="/regulamin"
              className="mt-3 inline-block text-sm font-bold text-jesien-rdza underline underline-offset-2"
            >
              Przeczytaj regulamin
            </Link>
          </Kontener>
        </section>

        <Stopka />
      </div>
    </div>
  );
}
