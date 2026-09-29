import { Blok, PasekSekcji, Saldo, SzkieletEkranu, Wiersz } from "@/components/Szkielet";

/** Kruk: plansza 3:4, rekord, ranking. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Kruk" podtytul="Przeleć między kolumnami — bez punktów, o sławę">
      <Blok className="aspect-[3/4]" />
      <div className="mt-4">
        <Saldo />
      </div>
      <PasekSekcji />
      <Wiersz ikona={false} liczba />
    </SzkieletEkranu>
  );
}
