import { Zaba } from "@/components/Zaba";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Galeria } from "./Galeria";

/**
 * Film tej edycji jeszcze nie istnieje — właściciel dopiero go nagra.
 * Sekcja pokazuje galerię zdjęć z poprzednich edycji (`Galeria`) i miejsce
 * na film: do czasu pliku niski pasek „wkrótce” (wcześniej wielka pusta
 * ramka 16:9 zjadała pół ekranu), z plikiem — odtwarzacz 16:9 bez
 * autoodtwarzania. Maskotka (`Zaba`) „trzyma” to miejsce za lewy róg.
 */
/**
 * Film tej edycji. Podmiana = pliki w `public/film/` i jedna linia tutaj,
 * np. `{ src: "/film/zapowiedz.mp4", plakat: "/film/zapowiedz.jpg" }`.
 */
const FILM: { src: string; plakat: string } | null = null;

export function Promocja() {
  return (
    <section id="promocja" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="06" nadtytul="Materiały" tytul="Zapowiedź" />

        <p className="text-sm leading-relaxed text-jesien-kora">
          Film z tej edycji pojawi się tutaj, gdy tylko powstanie. Na razie — jak
          było poprzednim razem.
        </p>

        <div className="mt-6">
          <Galeria />
        </div>

        <div className="relative mt-10">
          {FILM ? (
            <video
              controls
              preload="none"
              poster={FILM.plakat}
              className="aspect-video w-full rounded-lg bg-jesien-atrament"
            >
              <source src={FILM.src} type="video/mp4" />
            </video>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-jesien-dynia/60 bg-jesien-tlo/70 py-5 pl-24 pr-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Wkrótce</p>
              <p className="text-sm text-jesien-kora">Film tej edycji pojawi się tutaj, gdy tylko powstanie.</p>
            </div>
          )}
          <Zaba
            stan="powitanie"
            className="absolute -top-5 left-3 size-16 text-jesien-mech drop-shadow-[0_6px_14px_rgb(47_33_24/0.3)]"
          />
        </div>
      </Kontener>
    </section>
  );
}
