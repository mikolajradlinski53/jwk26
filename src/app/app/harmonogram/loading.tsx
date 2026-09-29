import { Pasek, PasekSekcji, SzkieletEkranu } from "@/components/Szkielet";

/** Harmonogram: nagłówek dnia i karta z punktami - godzina po lewej, opis po prawej. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Harmonogram" podtytul="Co, kiedy i gdzie">
      {[0, 1].map((d) => (
        <div key={d}>
          <PasekSekcji />
          <div className="szklo grid animate-pulse rounded-md px-4 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4 border-b border-white/8 py-3.5 last:border-b-0">
                <Pasek className="h-4 w-12 flex-none" />
                <div className="grid flex-1 gap-2">
                  <Pasek className="h-3.5 w-3/5" />
                  <Pasek className="h-3 w-4/5 bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SzkieletEkranu>
  );
}
