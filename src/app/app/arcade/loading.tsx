import { Saldo, SzkieletEkranu, Wiersz } from "@/components/Szkielet";

/** Kasyno: saldo i trzy kafle gier. */
export default function Ladowanie() {
  return (
    <SzkieletEkranu tytul="Kasyno" podtytul="Gra przeciwko twojemu saldu">
      <Saldo />
      <div className="grid gap-2.5">
        {[0, 1, 2].map((i) => (
          <Wiersz key={i} />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
