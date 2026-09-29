import { SzkieletEkranu, Wiersz } from "@/components/Szkielet";

/** Ranking: cztery drużyny — numer, nazwa z mottem, wynik. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Ranking Sekt" podtytul="Punkty ruszą razem z bingo">
      <div className="grid gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Wiersz key={i} liczba />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
