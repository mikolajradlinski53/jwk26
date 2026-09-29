import { Ekran } from "@/components/Ekran";
import { type NazwaIkony } from "@/components/Ikona";
import { LicznikKolejki, type Kolejki } from "@/components/KolejkiAdmina";
import { PozycjaMenu } from "@/components/PozycjaMenu";

const WEJSCIA: { href: string; nazwa: string; opis: string; ikona: NazwaIkony; kolejka?: keyof Kolejki }[] = [
  { href: "/app/admin/zapisy", nazwa: "Zapisy", opis: "Tury, miejsca i rezerwa", ikona: "zwoj" },
  { href: "/app/admin/rejestracje", nazwa: "Zgłoszenia", opis: "Kolejka oczekujących", ikona: "list", kolejka: "zgloszenia" },
  { href: "/app/admin/uczestnicy", nazwa: "Uczestnicy", opis: "Przyjęci: diety, ICE, zwolnienia, CSV", ikona: "osoby" },
  { href: "/app/admin/ogloszenia", nazwa: "Ogłoszenia", opis: "Powiadomienia push do wszystkich, drużyny, puli", ikona: "dzwonek" },
  { href: "/app/admin/harmonogram", nazwa: "Harmonogram", opis: "Program wyjazdu dzień po dniu", ikona: "zegar" },
  { href: "/app/admin/gossipy", nazwa: "Gossipy", opis: "Kategorie, ujawnianie, moderacja", ikona: "gwiazda", kolejka: "gossipy" },
  { href: "/app/admin/bingo", nazwa: "Bingo", opis: "Kolejka zdjęć z planszy", ikona: "plansza", kolejka: "bingo" },
  { href: "/app/admin/sklepik", nazwa: "Sklepik", opis: "Kolejka wydań i stan półki", ikona: "torba", kolejka: "sklepik" },
  { href: "/app/admin/punkty", nazwa: "Punkty", opis: "Przyznaj lub odbierz", ikona: "plus" },
  { href: "/app/admin/druzyny", nazwa: "Drużyny", opis: "Kapitani i salda", ikona: "tarcza" },
  { href: "/app/admin/historia", nazwa: "Historia", opis: "Ostatnie wpisy w księdze", ikona: "zegar" },
  { href: "/app/admin/ustawienia", nazwa: "Ustawienia", opis: "Daty i miejsce wydarzenia", ikona: "zebatka" },
];

/**
 * Sanktuarium. Liczniki przy pozycjach z kolejką liczy jedna funkcja
 * `admin_kolejki()` — te same liczby co na pasku i w „Więcej” (spec porządku, D3).
 */
export default function AdminPage() {
  return (
    <Ekran tytul="Sanktuarium" podtytul="Widoczne wyłącznie dla Kapłana">
      <nav className="grid gap-2.5">
        {WEJSCIA.map((w) => (
          <PozycjaMenu
            key={w.href}
            href={w.href}
            ikona={w.ikona}
            nazwa={w.nazwa}
            opis={w.opis}
            licznik={w.kolejka && <LicznikKolejki ktora={w.kolejka} />}
          />
        ))}
      </nav>
    </Ekran>
  );
}
