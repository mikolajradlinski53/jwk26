import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ustawienia } from "@/lib/ustawienia";
import { odliczanie } from "@/lib/odliczanie";
import { Naglowek } from "./landing/Naglowek";
import { Wejscie } from "./landing/Wejscie";
import { Opis } from "./landing/Opis";
import { Promocja } from "./landing/Promocja";
import { KiedyGdzie } from "./landing/KiedyGdzie";
import { Mapa } from "./landing/Mapa";
import { CenaIWplata } from "./landing/CenaIWplata";
import { JakSieZapisac } from "./landing/JakSieZapisac";
import { CoZabrac } from "./landing/CoZabrac";
import { Pytania } from "./landing/Pytania";
import { Licznik } from "./landing/Licznik";
import { Liscie } from "./landing/Liscie";
import { Stopka } from "./landing/Stopka";
import { SekcjaNaglowek } from "./landing/SekcjaNaglowek";
import { DzielnikFala, DzielnikSzewron, DzielnikSkos, DzielnikLisc } from "./landing/Dzielniki";
import { Kontener } from "./landing/Kontener";

/**
 * Tytuł i opis strony (karta tabu, podgląd linku na Instagramie/Messengerze)
 * nadpisują tu domyślne metadane z `layout.tsx` — te są napisane z myślą
 * o mrocznej apce ("Sekta Wyjazdowa" / "Rytuał trwa.") i landing nie może
 * ich zdradzić, nawet w miejscu, którego nikt nie czyta na oczy.
 * `themeColor` z layoutu jest z tego samego powodu ciemny — landing nadpisuje
 * go jasnym odcieniem tła, żeby pasek przeglądarki na telefonie nie był czarny.
 *
 * `appleWebApp.title` też trzeba nadpisać osobno: Next.js scala metadane
 * segmentów pole po polu, więc bez tego landing dziedziczyłby z layoutu
 * `appleWebApp: { title: "Sekta" }` — widoczne w `<meta name=
 * "apple-mobile-web-app-title">`, czyli dokładnie ten sam wyciek motywu,
 * przed którym ostrzega AGENTS.md, tylko w innym znaczniku niż title/description.
 */
export const metadata: Metadata = {
  title: "Jesienny Wyjazd Komisji 2026",
  description:
    "23 października, Karpacz. Wyjazd integracyjny Samorządu Studenckiego UE Wrocław — zapisz się.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jesienny Wyjazd Komisji",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf3e7",
  viewportFit: "cover",
};

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

        Sekcje (tu i w `Opis.tsx`/`Promocja.tsx`/`KiedyGdzie.tsx`) mają tła
        na 70% krycia (`bg-jesien-tlo/70`, `bg-jesien-karta/70`), nie pełne —
        inaczej zasłaniałyby liście wszędzie poza wąskimi paskami dzielników.
        70% to najgorszy bezpieczny przypadek: tekst w `jesien-kora` (ten sam
        odcień co liść) nad miejscem, gdzie liść w kryciu 0,65 akurat mija się
        z sekcją, daje ~4,9:1 (sekcja `karta`) i ~5,35:1 (sekcja `tlo`) —
        nadal nad progiem 4,5:1. Policzone przez blend alfa: liść na
        nieprzezroczystym `jesien-tlo` pod spodem, potem sekcja na to.
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
        <Mapa />

        {/*
          Skos zamiast powtórzenia dzielnika sprzed „Kiedy i gdzie" (Lisc):
          Mapa i KiedyGdzie stoją bez dzielnika między sobą (czytają się jako
          jedna sekcja), więc pierwszy prawdziwy podział rytmu wypada dopiero
          tutaj, na wyjściu w „Cenę i wpłatę".
        */}
        <DzielnikSkos kolorKlasa="bg-jesien-karta" tloKlasa="bg-jesien-tlo" />
        <CenaIWplata />
        <DzielnikSzewron />
        <JakSieZapisac />
        <DzielnikFala kolorKlasa="text-jesien-karta" tloKlasa="bg-jesien-tlo" />
        <CoZabrac />
        <DzielnikLisc />
        <Pytania />
        <DzielnikSzewron />

        <section className="bg-jesien-karta/70 mx-auto w-full px-4 py-14">
          <Kontener>
            <SekcjaNaglowek numer="08" nadtytul="Rekrutacja" tytul="Przyjęcie świeżaków" />
            <p className="text-sm leading-relaxed text-jesien-kora">
              Tydzień przed wyjazdem przyjmujemy nowych członków Samorządu —
              osobny, krótszy proces rekrutacyjny.
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

        <section className="bg-jesien-tlo/70 mx-auto w-full px-4 py-14">
          <Kontener>
            <SekcjaNaglowek numer="09" nadtytul="Zasady" tytul="Regulamin" />
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
