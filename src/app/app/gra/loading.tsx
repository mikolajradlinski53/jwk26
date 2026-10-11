import { Blok, SzkieletEkranu } from "@/components/Szkielet";

/** Gra terenowa: lista kart z zadaniami. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Gra terenowa" podtytul="Zadania dla drużyn">
      <div className="grid gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Blok key={i} className="h-32" />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
