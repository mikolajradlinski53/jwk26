import Link from "next/link";
import { PanelWezwania } from "./PanelWezwania";
import {
  IkonaFacebook,
  IkonaInstagram,
  KartaStopki,
  KolumnaNawigacji,
  ZnakMarki,
  type Odnosnik,
} from "./StopkaElementy";

// Placeholdery do podmiany: wydarzenie na Facebooku i profil „Nastukana"
// na Instagramie. Puste znaczy „nie pokazuj tej ikony" — lepszy brak
// odnośnika niż odnośnik prowadzący donikąd.
const SPOLECZNOSCI = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
} as const;

const KONTAKT_MAIL = "samorzad@samorzad.ue.wroc.pl";

// Wyłącznie trasy i kotwice, które naprawdę istnieją: `/wejscie`, `/regulamin`
// i identyfikatory sekcji nadane w `src/app/page.tsx`, `Opis.tsx`,
// `Promocja.tsx` i `KiedyGdzie.tsx`. Żadnych wymyślonych stron.
const NAWIGACJA_WYJAZD: Odnosnik[] = [
  { etykieta: "Czym to jest", href: "#o-wyjezdzie" },
  { etykieta: "Kiedy i gdzie", href: "#kiedy-gdzie" },
  { etykieta: "Zdjęcia", href: "#promocja" },
  { etykieta: "Regulamin", href: "/regulamin" },
];

// Kolumna „Samorząd” z briefu miałaby wyłącznie jeden odnośnik (Kontakt) —
// ikony społecznościowe siedzą już w kolumnie marki. Kolumna z jednym linkiem
// to dokładnie ten „ubogi” przypadek, przed którym ostrzega brief: zamiast
// dopychać ją wymyśloną treścią, Kontakt dołącza do „Zgłoszenia” i prawa
// strona zostaje dwiema kolumnami, nie trzema.
const NAWIGACJA_ZGLOSZENIE: Odnosnik[] = [
  { etykieta: "Wejdź do Sekty", href: "/wejscie" },
  { etykieta: "Kontakt", href: `mailto:${KONTAKT_MAIL}` },
  { etykieta: "Regulamin", href: "/regulamin" },
];

/**
 * Stopka landingu: ciemny panel wezwania (zapowiedź apki), jasny pasek
 * rozdzielający, pływająca karta z marką/nawigacją/copyrightem i gigantyczne
 * wyblakłe „JWK26" w tle.
 */
export function Stopka() {
  const maSpolecznosci = SPOLECZNOSCI.instagram || SPOLECZNOSCI.facebook;

  return (
    <footer className="relative mt-16 w-full pb-16">
      <PanelWezwania />

      <div className="stopka-pasek mx-4 mt-[14px]" aria-hidden="true" />

      <KartaStopki>
        <div
          className="flex flex-col gap-10
                     min-[851px]:grid min-[851px]:grid-cols-[2.25fr_1.65fr]
                     min-[851px]:items-start min-[851px]:gap-x-[clamp(50px,9vw,125px)]"
        >
          {/* Marka */}
          <div>
            <div className="stopka-znak inline-flex">
              <ZnakMarki />
            </div>

            <p className="mt-[27px] max-w-[420px] text-[11.5px] leading-[1.55] text-jesien-kora">
              Jesienny Wyjazd Komisji to trzy dni w Karpaczu, na które jedzie samorząd
              Uniwersytetu Ekonomicznego we Wrocławiu. Integracja, rywalizacja i kilka
              rzeczy, o których lepiej nie pisać.
            </p>

            {maSpolecznosci ? (
              <div className="mt-[21px] flex items-center gap-[13px]">
                {SPOLECZNOSCI.instagram && (
                  <a
                    href={SPOLECZNOSCI.instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="JWK26 na Instagramie"
                    className="flex size-11 items-center justify-center text-jesien-atrament
                               transition duration-200 hover:-translate-y-[3px] hover:opacity-[0.56]
                               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
                  >
                    <span className="size-[17px]">
                      <IkonaInstagram />
                    </span>
                  </a>
                )}
                {SPOLECZNOSCI.facebook && (
                  <a
                    href={SPOLECZNOSCI.facebook}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="JWK26 na Facebooku"
                    className="flex size-11 items-center justify-center text-jesien-atrament
                               transition duration-200 hover:-translate-y-[3px] hover:opacity-[0.56]
                               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
                  >
                    <span className="size-[17px]">
                      <IkonaFacebook />
                    </span>
                  </a>
                )}
              </div>
            ) : null}
          </div>

          {/* Nawigacja — dwie kolumny, patrz komentarz przy NAWIGACJA_ZGLOSZENIE */}
          <div className="grid grid-cols-2 gap-x-[clamp(30px,4vw,54px)] gap-y-[38px] min-[600px]:gap-y-6">
            <KolumnaNawigacji tytul="Wyjazd" odnosniki={NAWIGACJA_WYJAZD} />
            <KolumnaNawigacji tytul="Zgłoszenie" odnosniki={NAWIGACJA_ZGLOSZENIE} />
          </div>
        </div>

        <div className="mt-[33px] mb-[27px] h-px bg-jesien-atrament/[0.11]" />

        <div className="flex flex-col gap-4 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between">
          <p className="text-[10.5px] text-jesien-kora">
            © 2026 Samorząd Studencki UE we Wrocławiu
          </p>
          <Link
            href="/regulamin"
            className="flex min-h-11 w-fit items-center text-[10.5px] text-jesien-kora underline
                       underline-offset-[3px] transition hover:text-jesien-atrament
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
          >
            Regulamin wyjazdu
          </Link>
        </div>
      </KartaStopki>

      <div
        className="relative z-0 -mt-16 flex h-[86px] justify-center overflow-hidden
                   min-[600px]:-mt-24 min-[600px]:h-[168px]"
        aria-hidden="true"
      >
        <p
          className="stopka-slowo translate-y-[22px] select-none text-center font-tytul
                     text-[30vw] min-[600px]:text-[clamp(125px,19.5vw,270px)]"
        >
          JWK26
        </p>
      </div>
    </footer>
  );
}
