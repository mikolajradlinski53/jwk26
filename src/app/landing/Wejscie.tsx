import Image from "next/image";
import Link from "next/link";
import { odliczanie } from "@/lib/odliczanie";
import { Licznik } from "./Licznik";

/**
 * Sekcja wejściowa — pierwsze, co widać po otwarciu landingu. Zdjęcie
 * `hero-8` (grupowe selfie na pomoście, złote drzewa) jako tło, logo, licznik
 * i przycisk wejścia na nim.
 *
 * Musi być czytelna w pierwszej klatce:
 * - Żadnej sekcji na `100vh` — wysokość idzie z `aspect-*` (rezerwuje miejsce
 *   od razu, zanim zdjęcie się doładuje — zero „białej dziury"), nie z
 *   viewportu, więc nie wypycha reszty strony poza pierwszy kadr.
 * - Zdjęcie ładowane z `preload` (następca `priority` w Next 16 — starsze
 *   API jest tu przestarzałe) i `fetchPriority="high"`, żeby przeglądarka
 *   zaczęła je pobierać od razu, nie dopiero gdy dotrze do niego w drzewie.
 * - Licznik dostaje `poczatkowe` policzone tutaj, na serwerze — bez tego
 *   pokazywałby kreskę, dopóki nie doładuje się JavaScript.
 *
 * Kontrast tekstu na zdjęciu: `.hero-przyciemnienie` w globals.css to gradient
 * czerni zmierzony względem najjaśniejszego piksela `hero-8.jpg` (prawie
 * czysta biel, ok. 249/255, w górnej jednej dziesiątej kadru), nie względem
 * średniej jasności zdjęcia — przy 62% na tym pikselu wychodzi kontrast
 * ok. 6,2:1 dla białego tekstu, z zapasem nad progiem 4,5:1. Sam licznik
 * i tak siedzi na własnej nieprzezroczystej karcie (`jesien-karta`), więc
 * jego czytelność nie zależy od zdjęcia w ogóle — przyciemnienie chroni
 * logo i przycisk.
 */
export function Wejscie({ dataJwk }: { dataJwk: string | null }) {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative aspect-[3/4] w-full min-[600px]:aspect-[16/10] min-[900px]:aspect-[21/9]">
        <Image
          src="/hero/hero-8.jpg"
          alt="Grupa uczestników poprzedniego wyjazdu śmieje się na pomoście nad jesiennym jeziorem, w tle złote drzewa"
          fill
          preload
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />

        <div className="hero-przyciemnienie absolute inset-0" aria-hidden="true" />

        <div
          className="relative z-10 flex h-full flex-col items-center justify-between gap-6
                     px-4 pt-[calc(env(safe-area-inset-top,0px)+64px)] pb-10 text-center
                     min-[600px]:pt-20"
        >
          <Image
            src="/logo/logo-biale.png"
            alt="Jesienny Wyjazd Komisji"
            width={1600}
            height={597}
            className="h-9 w-auto drop-shadow-[0_2px_10px_rgb(0_0_0/0.45)] min-[600px]:h-11"
          />

          <div className="grid justify-items-center gap-6">
            <Licznik
              docelowa={dataJwk}
              etykieta="Do wyjazdu"
              poTerminie="Trwa"
              poczatkowe={odliczanie(dataJwk, new Date())}
            />

            <Link
              href="/wejscie"
              className="flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full
                         border border-jesien-rdza/40 bg-jesien-rdza px-5 text-sm font-bold text-white
                         shadow-[0_14px_30px_-12px_rgb(12_7_9/0.6)] transition hover:brightness-110
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Wejdź do Sekty
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
