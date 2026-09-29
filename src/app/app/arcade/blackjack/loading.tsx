import { Blok, Pasek, PasekSekcji, Saldo, SzkieletEkranu } from "@/components/Szkielet";

/** Blackjack: saldo, obrót, trzy stawki, zasady, historia. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Blackjack" podtytul="Gra przeciwko twojemu saldu">
      <Saldo />
      <Pasek className="mb-4 ml-1 h-3 w-3/4 bg-white/5" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <Pasek key={i} className="h-12" />
        ))}
      </div>
      <PasekSekcji />
      <Blok className="h-24" />
    </SzkieletEkranu>
  );
}
