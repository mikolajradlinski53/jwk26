import { SzkieletEkranu, Wiersz } from "@/components/Szkielet";

/** Sanktuarium: lista pozycji z ikonami. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Sanktuarium" podtytul="Widoczne wyłącznie dla Kapłana">
      <div className="grid gap-2.5">
        {Array.from({ length: 11 }, (_, i) => (
          <Wiersz key={i} />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
