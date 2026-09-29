import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Ikona, type NazwaIkony } from "@/components/Ikona";
import { LicznikZamowien } from "./LicznikZamowien";

const WEJSCIA: { href: string; nazwa: string; opis: string; ikona: NazwaIkony }[] = [
  { href: "/app/admin/zapisy", nazwa: "Zapisy", opis: "Tury, miejsca i rezerwa", ikona: "zwoj" },
  { href: "/app/admin/rejestracje", nazwa: "Zgłoszenia", opis: "Kolejka oczekujących", ikona: "list" },
  { href: "/app/admin/uczestnicy", nazwa: "Uczestnicy", opis: "Przyjęci: diety, ICE, zwolnienia, CSV", ikona: "osoby" },
  { href: "/app/admin/ogloszenia", nazwa: "Ogłoszenia", opis: "Powiadomienia push do wszystkich, drużyny, puli", ikona: "dzwonek" },
  { href: "/app/admin/gossipy", nazwa: "Gossipy", opis: "Kategorie, ujawnianie, moderacja", ikona: "gwiazda" },
  { href: "/app/admin/bingo", nazwa: "Bingo", opis: "Kolejka zdjęć z planszy", ikona: "plansza" },
  { href: "/app/admin/sklepik", nazwa: "Sklepik", opis: "Kolejka wydań i stan półki", ikona: "torba" },
  { href: "/app/admin/punkty", nazwa: "Punkty", opis: "Przyznaj lub odbierz", ikona: "plus" },
  { href: "/app/admin/druzyny", nazwa: "Drużyny", opis: "Kapitani i salda", ikona: "tarcza" },
  { href: "/app/admin/historia", nazwa: "Historia", opis: "Ostatnie wpisy w księdze", ikona: "zegar" },
  { href: "/app/admin/ustawienia", nazwa: "Ustawienia", opis: "Daty i miejsce wydarzenia", ikona: "zebatka" },
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
            transitionTypes={["nav-forward"]}
            className="szklo flex items-center gap-3 rounded-md px-4 py-3.5
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
          >
            <Ikona nazwa={w.ikona} className="size-10 flex-none text-kosc" />
            <span className="min-w-0 flex-1">
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
