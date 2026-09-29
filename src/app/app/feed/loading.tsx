import { Blok, Kolko, Pasek, SzkieletEkranu } from "@/components/Szkielet";
import { NaglowekFeedu } from "./NaglowekFeedu";

/** Feed: wpisy - autor, kwadratowe zdjęcie, reakcje. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Feed" naglowek={<NaglowekFeedu />}>
      <div className="grid gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-2.5">
            <div className="flex items-center gap-2.5 px-1">
              <Kolko className="size-8" />
              <Pasek className="h-3 w-32" />
            </div>
            <Blok className="aspect-square" />
            <div className="flex gap-3 px-1">
              <Pasek className="h-3 w-12" />
              <Pasek className="h-3 w-16 bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </SzkieletEkranu>
  );
}
