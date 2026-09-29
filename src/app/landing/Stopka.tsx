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
import { KOORDYNATOR_MAIL } from "@/lib/regulamin";
import type { Social } from "@/lib/ustawienia";
import type { OdslonaWidok } from "@/lib/odslony";

const KLASA_LINKU_DOLNEGO =
  "flex min-h-11 w-fit items-center text-[10.5px] text-jesien-kora underline underline-offset-[3px] transition " +
  "hover:text-jesien-atrament focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza";

const KLASA_IKONY =
  "flex size-11 items-center justify-center text-jesien-atrament transition duration-200 hover:-translate-y-[3px] " +
  "hover:opacity-[0.56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza";

/**
 * Stopka landingu: panel wezwania, jasny pasek rozdzielający, pływająca karta
 * z marką/nawigacją/copyrightem i gigantyczne wyblakłe „JWK26" w tle.
 *
 * Nawigacja wskazuje wyłącznie kotwice i trasy, które istnieją. „Zapisy”
 * prowadzą na `/wejscie` dopiero po odsłonie zapisów — przedtem do sekcji
 * z licznikiem. Ikony społecznościowe biorą adresy z Ustawień; pusty adres
 * = brak ikony (lepszy brak odnośnika niż odnośnik donikąd).
 */
export function Stopka({ zapisy, social, maPlan }: { zapisy: OdslonaWidok; social: Social; maPlan: boolean }) {
  const nawigacjaWyjazd: Odnosnik[] = [
    { etykieta: "Czym to jest", href: "#o-wyjezdzie" },
    ...(maPlan ? [{ etykieta: "Plan", href: "#plan" }] : []),
    { etykieta: "Kiedy i gdzie", href: "#kiedy-gdzie" },
    { etykieta: "Zdjęcia", href: "#promocja" },
  ];
  const nawigacjaZgloszenie: Odnosnik[] = [
    { etykieta: "Zapisy", href: zapisy.odsloniete ? "/wejscie" : "#zapisy" },
    { etykieta: "Pytania", href: "#pytania" },
    { etykieta: "Kontakt", href: `mailto:${KOORDYNATOR_MAIL}` },
    { etykieta: "Regulamin", href: "/regulamin" },
    { etykieta: "Polityka prywatności", href: "/prywatnosc" },
  ];
  const maSpolecznosci = social.instagram || social.facebook;

  return (
    <footer className="relative mt-16 w-full pb-16">
      <PanelWezwania zapisy={zapisy} />

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
              Jesienny Wyjazd Komisji to trzy dni w górach, na które jedzie Samorząd Studentów
              Uniwersytetu Ekonomicznego we Wrocławiu. Integracja, rywalizacja i kilka rzeczy,
              o których lepiej nie pisać.
            </p>

            {maSpolecznosci ? (
              <div className="mt-[21px] flex items-center gap-[13px]">
                {social.instagram && (
                  <a
                    href={social.instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="JWK26 na Instagramie"
                    className={KLASA_IKONY}
                  >
                    <span className="size-[17px]">
                      <IkonaInstagram />
                    </span>
                  </a>
                )}
                {social.facebook && (
                  <a
                    href={social.facebook}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="JWK26 na Facebooku"
                    className={KLASA_IKONY}
                  >
                    <span className="size-[17px]">
                      <IkonaFacebook />
                    </span>
                  </a>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-[clamp(30px,4vw,54px)] gap-y-[38px] min-[600px]:gap-y-6">
            <KolumnaNawigacji tytul="Wyjazd" odnosniki={nawigacjaWyjazd} />
            <KolumnaNawigacji tytul="Zgłoszenie" odnosniki={nawigacjaZgloszenie} />
          </div>
        </div>

        <div className="mt-[33px] mb-[27px] h-px bg-jesien-atrament/[0.11]" />

        <div className="flex flex-col gap-4 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between">
          <p className="text-[10.5px] text-jesien-kora">© 2026 Samorząd Studentów UE we Wrocławiu</p>
          <div className="flex flex-wrap gap-x-5">
            <Link href="/regulamin" className={KLASA_LINKU_DOLNEGO}>
              Regulamin wyjazdu
            </Link>
            <Link href="/prywatnosc" className={KLASA_LINKU_DOLNEGO}>
              Polityka prywatności
            </Link>
          </div>
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
