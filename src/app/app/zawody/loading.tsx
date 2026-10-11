import { Blok, SzkieletEkranu } from "@/components/Szkielet";

/** Zawody: karty Topalek, siatkówki, pokera i szachów. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Zawody" podtytul="Toplakyyy, siatkówka, poker, szachy">
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Blok key={i} className="h-28" />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
