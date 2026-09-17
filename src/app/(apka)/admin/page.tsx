import Link from "next/link";
import { Ekran } from "@/components/Ekran";

const WEJSCIA = [
  { href: "/admin/rejestracje", nazwa: "Zgłoszenia", opis: "Kolejka oczekujących" },
  { href: "/admin/bingo", nazwa: "Bingo", opis: "Kolejka zdjęć z planszy" },
  { href: "/admin/punkty", nazwa: "Punkty", opis: "Przyznaj lub odbierz" },
  { href: "/admin/historia", nazwa: "Historia", opis: "Ostatnie wpisy w księdze" },
];

export default function AdminPage() {
  return (
    <Ekran tytul="Sanktuarium" podtytul="Widoczne wyłącznie dla Kapłana">
      <nav className="grid gap-2.5">
        {WEJSCIA.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            className="szklo rounded-md px-4 py-3.5
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
          >
            <span className="block text-sm font-bold">{w.nazwa}</span>
            <span className="block text-xs text-dym">{w.opis}</span>
          </Link>
        ))}
      </nav>
    </Ekran>
  );
}
