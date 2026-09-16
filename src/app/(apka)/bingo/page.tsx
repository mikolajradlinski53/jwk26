import { Ekran } from "@/components/Ekran";

export default function BingoPage() {
  return (
    <Ekran tytul="Bingo" podtytul="Plansza drużyny">
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
        Plansza zapali się razem z pierwszym zadaniem. Do tego czasu punkty
        przyznaje wyłącznie Kapłan.
      </p>
    </Ekran>
  );
}
