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
 * Wyłącznie zdjęcia samego ośrodka — żadnego zdjęcia grupowego z poprzedniej
 * edycji. Sekcja o miejscu ma pokazywać miejsce, nie ludzi; zdjęcia z ludźmi
 * (w tym dawne `hero-9`, które stało tu wcześniej) należą do galerii w
 * `Promocja.tsx`/`Galeria.tsx`.
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
    <section id="kiedy-gdzie" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="03" nadtytul="Lokalizacja" tytul="Kiedy i gdzie" />

        {/*
          Dwa zdjęcia samego ośrodka, obok siebie: `osrodek-1` (1024×768)
          w szerszej kolumnie, `osrodek-2` (516×387 — mały oryginał) w wąskiej.
          Węższa kolumna i `sizes` dopasowane do jej realnej szerokości trzymają
          `osrodek-2` przy jego naturalnym rozmiarze zamiast rozciągać go na
          duży kafelek, na którym zmiękłby.
        */}
        <div className="grid grid-cols-[1.7fr_1fr] gap-2.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src="/hero/osrodek-1.jpg"
              alt="Front budynku ośrodka w słoneczny dzień — biała willa z drewnianym gankiem, czerwonymi parasolami tarasowymi i różami przy wejściu"
              fill
              sizes="(min-width: 850px) 460px, 55vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src="/hero/osrodek-2.jpg"
              alt="Brama wjazdowa i podjazd prowadzący do budynku ośrodka"
              fill
              sizes="(min-width: 850px) 220px, 33vw"
              className="object-cover"
            />
          </div>
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
