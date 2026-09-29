import { Kolko, Pasek, Saldo, SzkieletEkranu } from "@/components/Szkielet";

/** Sklepik: saldo drużyny i pozycje na półce. Podtytuł to nazwa drużyny — z danych. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Sklepik" podtytul>
      <Saldo />
      <div className="grid gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="szklo flex animate-pulse gap-3 rounded-md px-4 py-4">
            <Kolko className="size-7" />
            <div className="grid flex-1 gap-2">
              <Pasek className="h-3 w-2/5" />
              <Pasek className="h-2.5 w-3/5 bg-white/5" />
              <Pasek className="mt-1 h-2 w-16 bg-white/5" />
            </div>
            <Pasek className="h-5 w-9" />
          </div>
        ))}
      </div>
    </SzkieletEkranu>
  );
}
