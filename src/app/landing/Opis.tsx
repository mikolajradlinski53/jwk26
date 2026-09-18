import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/** Krótki opis wydarzenia — czym jest JWK, bez lania wody. */
export function Opis() {
  return (
    <section id="o-wyjezdzie" className="bg-jesien-tlo mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="01" nadtytul="Wyjazd" tytul="Czym to jest" />
        <div className="grid gap-3 text-sm leading-relaxed text-jesien-kora">
          <p>
            Raz w roku Komisja znika z uczelni na trzy dni. JWK to nie jest
            szkolenie ani konferencja — to wyjazd, na który się jedzie, żeby
            naprawdę się poznać, zanim znowu zderzymy się na korytarzu
            z terminami.
          </p>
          <p>
            Nikt nie jedzie sam. Drużyny, gry, ognisko, plan, który i tak się
            rozjedzie. Tydzień wcześniej przyjmujemy też świeżaków — kto
            przetrwa rytuał wtajemniczenia, wsiada do autokaru razem z nami.
          </p>
        </div>
      </Kontener>
    </section>
  );
}
