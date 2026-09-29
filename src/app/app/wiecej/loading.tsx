import { Blok, Pasek, PasekSekcji, Saldo, SzkieletEkranu } from "@/components/Szkielet";

/** „Więcej”: drużyna z saldem, pozycje, powiadomienia. Podtytuł to ksywka — z danych. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Więcej" podtytul>
      <Saldo />
      <div className="grid gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="szklo flex min-h-12 animate-pulse items-center rounded-md px-4">
            <Pasek className="h-3 w-24" />
          </div>
        ))}
      </div>
      <PasekSekcji />
      <Blok className="h-32" />
    </SzkieletEkranu>
  );
}
