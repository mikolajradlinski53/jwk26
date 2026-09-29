import { Blok, Pasek, PasekSekcji, Saldo, SzkieletEkranu } from "@/components/Szkielet";

/** Sloty: saldo, trzy bębny, przycisk, historia. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Sloty" podtytul="Gra przeciwko twojemu saldu">
      <Saldo />
      <div className="szklo grid grid-cols-3 gap-2 rounded-md px-3 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="beben aspect-[4/3] animate-pulse rounded-sm" />
        ))}
      </div>
      <Pasek className="mt-4 h-12 w-full" />
      <PasekSekcji />
      <Blok className="h-11" />
    </SzkieletEkranu>
  );
}
