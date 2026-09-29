import { Blok, SzkieletEkranu } from "@/components/Szkielet";

/** Bingo: plansza 5 × 5. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Bingo" podtytul="Plansza drużyny">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 25 }, (_, i) => (
          <Blok key={i} className="aspect-square" />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
