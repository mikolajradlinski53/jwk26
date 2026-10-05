import Image from "next/image";
import { odliczanie } from "@/lib/odliczanie";
import { DATY_WYJAZDU, type OdslonaWidok } from "@/lib/odslony";
import { Licznik } from "./Licznik";
import { PrzyciskZapisu } from "./PrzyciskZapisu";
import { ZabaStala } from "./zaba/ZabaStala";

/**
 * Zdjęcie tła hero. `null` = placeholder (gradient) - dotychczasowe zdjęcie
 * `hero-8` przeszło do galerii 2026-10-05, nowe dopiero będzie. Podmiana:
 * plik w `public/hero/` i ścieżka tutaj, np. `"/hero/hero-30.jpg"`.
 */
const ZDJECIE_HERO: string | null = null;

/**
 * Sekcja wejściowa - pierwsze, co widać po otwarciu landingu. Zdjęcie
 * z poprzedniej edycji jako tło, logo, licznik, przycisk zapisu i
 * „Aktualności” (skok do materiałów tej edycji) na nim.
 *
 * Musi być czytelna w pierwszej klatce:
 * - Żadnej sekcji na `100vh` - wysokość idzie z `aspect-*` (rezerwuje miejsce
 *   od razu, zanim zdjęcie się doładuje - zero „białej dziury"), nie z
 *   viewportu, więc nie wypycha reszty strony poza pierwszy kadr.
 * - Zdjęcie ładowane z `preload` (następca `priority` w Next 16 - starsze
 *   API jest tu przestarzałe) i `fetchPriority="high"`, żeby przeglądarka
 *   zaczęła je pobierać od razu, nie dopiero gdy dotrze do niego w drzewie.
 * - Licznik dostaje `poczatkowe` policzone tutaj, na serwerze - bez tego
 *   pokazywałby kreskę, dopóki nie doładuje się JavaScript.
 *
 * Kontrast tekstu na zdjęciu: `.hero-przyciemnienie` w globals.css to gradient
 * czerni zmierzony względem najjaśniejszego piksela dawnego `hero-8.jpg`
 * (przy nowym zdjęciu sprawdzić ponownie) (prawie
 * czysta biel, ok. 249/255, w górnej jednej dziesiątej kadru), nie względem
 * średniej jasności zdjęcia - przy 62% na tym pikselu wychodzi kontrast
 * ok. 6,2:1 dla białego tekstu, z zapasem nad progiem 4,5:1. Sam licznik
 * i tak siedzi na własnej nieprzezroczystej karcie (`jesien-karta`), więc
 * jego czytelność nie zależy od zdjęcia w ogóle - przyciemnienie chroni
 * logo i przycisk.
 */
export function Wejscie({
  dataJwk,
  zapisy,
  miasto,
}: {
  dataJwk: string | null;
  zapisy: OdslonaWidok;
  /** `null` przed odsłoną ośrodka. */
  miasto: string | null;
}) {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Minimalna wysokość obok proporcji: pod licznikiem doszły data
          i licznik zapisów, a przy 21:9 na komputerze przycisk wjeżdżał
          pod falę. Proporcja nadal rezerwuje miejsce w pierwszej klatce. */}
      <div
        className="relative aspect-[3/4] min-h-[600px] w-full min-[600px]:aspect-[16/10] min-[600px]:min-h-[720px]
                   min-[900px]:aspect-[21/9]"
      >
        {ZDJECIE_HERO ? (
          <Image
            src={ZDJECIE_HERO}
            alt=""
            fill
            preload
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          // Placeholder do czasu nowego zdjęcia: jesienna poświata nad nocą,
          // ciemny dół jak u zdjęcia, żeby fala pod hero dalej z niego wypływała.
          <div
            className="absolute inset-0 bg-noc bg-[radial-gradient(ellipse_at_30%_20%,rgb(200_95_45/0.55),transparent_60%),radial-gradient(ellipse_at_80%_70%,rgb(140_60_30/0.45),transparent_55%)]"
            aria-hidden="true"
          />
        )}

        {/* Przyciemnienie tylko pod zdjęcie - placeholder jest ciemny sam z siebie. */}
        {ZDJECIE_HERO && <div className="hero-przyciemnienie absolute inset-0" aria-hidden="true" />}

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
            preload
            className="h-auto w-[clamp(220px,80%,620px)] drop-shadow-[0_2px_10px_rgb(0_0_0/0.45)]"
          />

          <div className="grid justify-items-center gap-6">
            <div className="relative grid justify-items-center gap-3">
              {/* Przewodnik wita, siedząc na rogu karty licznika; dalej po
                  stronie chodzi jego wędrująca wersja (zaba/Przewodnik.tsx). */}
              <ZabaStala poza="siedzi" skala={1} className="absolute -top-[72px] right-0 z-10" />
              <Licznik
                docelowa={dataJwk}
                etykieta="Do wyjazdu"
                poTerminie="Trwa"
                poczatkowe={odliczanie(dataJwk, new Date())}
                rozmiar="duzy"
              />
              <p className="text-sm font-bold text-white drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)]">
                {DATY_WYJAZDU} · {miasto ?? "miejsce wkrótce"}
              </p>
            </div>
            <div className="grid justify-items-center gap-3">
              <PrzyciskZapisu odslona={zapisy} wariant="hero" />
              <a
                href="#aktualnosci"
                className="flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full border
                           border-white/70 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur-sm transition
                           hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-white"
              >
                Aktualności
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
