import { Pasek, SzkieletEkranu } from "@/components/Szkielet";

/** Gossipy: karty kategorii — status, tytuł, opis, formularz nominacji. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Gossipy" podtytul="Anonimowe nominacje">
      <div className="grid gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="szklo grid animate-pulse gap-3 rounded-md px-4 py-4">
            <Pasek className="h-2 w-16 bg-white/5" />
            <Pasek className="h-5 w-3/5" />
            <Pasek className="h-3 w-4/5 bg-white/5" />
            <div className="mt-1 grid gap-2">
              <Pasek className="h-10 w-full bg-white/5" />
              <Pasek className="h-10 w-full bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </SzkieletEkranu>
  );
}
