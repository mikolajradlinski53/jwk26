import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { LicznikZamowien } from "./LicznikZamowien";

const WEJSCIA = [
  { href: "/app/admin/rejestracje", nazwa: "Zgłoszenia", opis: "Kolejka oczekujących" },
  { href: "/app/admin/bingo", nazwa: "Bingo", opis: "Kolejka zdjęć z planszy" },
  { href: "/app/admin/sklepik", nazwa: "Sklepik", opis: "Kolejka wydań i stan półki" },
  { href: "/app/admin/punkty", nazwa: "Punkty", opis: "Przyznaj lub odbierz" },
  { href: "/app/admin/druzyny", nazwa: "Drużyny", opis: "Kapitani i salda" },
  { href: "/app/admin/historia", nazwa: "Historia", opis: "Ostatnie wpisy w księdze" },
  { href: "/app/admin/ustawienia", nazwa: "Ustawienia", opis: "Daty i miejsce wydarzenia" },
];

export default async function AdminPage() {
  const supabase = await createClient();

  // Licznik liczy zamówienia wprost z shop_orders, a nie z outboxu powiadomień:
  // outbox zostanie kiedyś opróżniony przez transport z kroku 8 i wtedy
  // przestałby być prawdą o kolejce.
  const { count } = await supabase
    .from("shop_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <Ekran tytul="Sanktuarium" podtytul="Widoczne wyłącznie dla Kapłana">
      <nav className="grid gap-2.5">
        {WEJSCIA.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            className="szklo flex items-center gap-3 rounded-md px-4 py-3.5
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold">{w.nazwa}</span>
              <span className="block text-xs text-dym">{w.opis}</span>
            </span>
            {w.href === "/app/admin/sklepik" && (
              <LicznikZamowien poczatkowa={count ?? 0} />
            )}
          </Link>
        ))}
      </nav>
    </Ekran>
  );
}
