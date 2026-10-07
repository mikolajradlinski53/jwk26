import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { ZabaStala } from "./zaba/ZabaStala";
import { KopiujMaly } from "@/components/KopiujMaly";
import { AdresEmail } from "@/components/AdresEmail";
import { KOORDYNATOR, KOORDYNATOR_MAIL, KOORDYNATOR_TELEFON } from "@/lib/regulamin";

const DOKUMENTY = [
  {
    href: "/regulamin",
    tytul: "Regulamin",
    opis: "Zasady uczestnictwa w wyjeździe.",
  },
  {
    href: "/prywatnosc",
    tytul: "Polityka prywatności",
    opis: "Dane zbierane przez aplikację oraz ich przechowywanie.",
  },
];

/**
 * Regulamin i polityka prywatności - osobne trasy, żeby dało się je linkować.
 * Otwierają się w nowej karcie, żeby czytający nie gubił miejsca na landingu.
 *
 * Pod nimi kontakt do koordynatora (tu prowadzi „Kontakt” ze stopki). Adres
 * do skopiowania, nie `mailto:` - na części telefonów link otwierał
 * nieskonfigurowaną albo przypadkową aplikację.
 */
export function Dokumenty() {
  return (
    <section id="dokumenty" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="09" nadtytul="Zasady" tytul="Dokumenty" zaba={<ZabaStala poza="czyta" skala={1} />} />
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          {DOKUMENTY.map((d) => (
            <a
              key={d.href}
              href={d.href}
              target="_blank"
              rel="noopener"
              className="grid gap-1 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5 transition
                         hover:border-jesien-rdza/40 focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-jesien-rdza"
            >
              <span className="font-tytul text-lg text-jesien-atrament">{d.tytul}</span>
              <span className="text-sm leading-relaxed text-jesien-kora">{d.opis}</span>
              <span className="mt-1 text-sm font-bold text-jesien-rdza">Przeczytaj →</span>
            </a>
          ))}
        </div>

        <div
          id="kontakt"
          className="mt-3 grid scroll-mt-24 gap-1.5 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5"
        >
          <span className="font-tytul text-lg text-jesien-atrament">Kontakt</span>
          <span className="text-sm text-jesien-kora">{KOORDYNATOR}, koordynator wyjazdu</span>
          <p className="flex items-center justify-between gap-3 text-sm text-jesien-atrament">
            <AdresEmail adres={KOORDYNATOR_MAIL} />
            <span className="text-jesien-rdza">
              <KopiujMaly tekst={KOORDYNATOR_MAIL} co="adres e-mail" />
            </span>
          </p>
          <a
            href={`tel:${KOORDYNATOR_TELEFON.replace(/\s/g, "")}`}
            className="w-fit text-sm font-bold text-jesien-rdza underline underline-offset-2"
          >
            {KOORDYNATOR_TELEFON}
          </a>
        </div>
      </Kontener>
    </section>
  );
}
