import Image from "next/image";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/**
 * Sekcja miejsca. Gdy `miejsceNazwa` albo `miejsceAdres` jest puste (awaria
 * odczytu `ustawienia()`, albo po prostu jeszcze nie uzupełnione w panelu),
 * renderuje tylko to, co ma — bez pustego nagłówka i bez łamania układu.
 * Gdy nie ma nic, sekcja znika całkiem, zamiast zostawiać martwy nagłówek
 * „Gdzie" nad pustką.
 *
 * Zdjęcie ośrodka: `hero-9` — duża grupa we wspólnej sali ośrodka, w
 * proporcjach zbliżonych do oryginału (1800×1013 ≈ 16:9) — pasuje do
 * poziomej karty nad adresem lepiej niż pionowe `hero-10` przy
 * jednokolumnowym układzie telefonu, i akurat tu pokazuje samo miejsce,
 * nie tylko ludzi.
 */
export function KiedyGdzie({
  miejsceNazwa,
  miejsceAdres,
}: {
  miejsceNazwa: string | null;
  miejsceAdres: string | null;
}) {
  if (!miejsceNazwa && !miejsceAdres) return null;

  return (
    <section id="kiedy-gdzie" className="bg-jesien-tlo mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="03" nadtytul="Lokalizacja" tytul="Kiedy i gdzie" />

        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
          <Image
            src="/hero/hero-9.jpg"
            alt="Duża grupa uczestników poprzedniej edycji pozuje razem we wspólnej sali ośrodka"
            fill
            sizes="(min-width: 850px) 700px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="mt-4 grid gap-1.5 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
          {miejsceNazwa && <p className="text-sm font-bold text-jesien-atrament">{miejsceNazwa}</p>}
          {miejsceAdres && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(miejsceAdres)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-jesien-rdza underline underline-offset-2"
            >
              {miejsceAdres}
            </a>
          )}
        </div>
      </Kontener>
    </section>
  );
}
