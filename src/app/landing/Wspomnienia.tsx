import { ZabaStala } from "./zaba/ZabaStala";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Galeria } from "./Galeria";

/**
 * „Wspomnienia” - galeria zdjęć z poprzednich edycji (`Galeria`). Materiały
 * z tej edycji mają osobną sekcję (`Aktualnosci`), do której prowadzi
 * przycisk z hero.
 */
export function Wspomnienia() {
  return (
    <section id="wspomnienia" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek
          numer="06"
          nadtytul="Wspomnienia"
          tytul="Wróćmy na chwilę do poprzednich wyjazdów!"
          zaba={<ZabaStala poza="mysli" skala={1} />}
        />
        <Galeria />
      </Kontener>
    </section>
  );
}
