import { SzkieletEkranu, Wiersz } from "@/components/Szkielet";

/** Ranking: sześć drużyn - numer, nazwa z mottem, wynik. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Ranking Sekt" podtytul="Punkty ruszą razem z bingo">
      <div className="grid gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Wiersz key={i} liczba />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
