import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { ZabaStala } from "./zaba/ZabaStala";

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
      </Kontener>
    </section>
  );
}
