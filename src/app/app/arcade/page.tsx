import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { type NazwaIkony } from "@/components/Ikona";
import { PozycjaMenu } from "@/components/PozycjaMenu";
import { Wroc } from "@/components/Wroc";
import type { UserScore } from "@/types/db";
import { KartaPuli, wczytajPule } from "./Pula";

const GRY: { href: string; nazwa: string; opis: string; ikona: NazwaIkony }[] = [
  { href: "/app/arcade/sloty", nazwa: "Sloty", opis: "stawka 10 · z puli na 12 h", ikona: "swieca" },
  { href: "/app/arcade/blackjack", nazwa: "Blackjack", opis: "stawka 10 · 20 · 50", ikona: "karty" },
  { href: "/app/arcade/kruk", nazwa: "Kruk", opis: "ranking, bez punktów", ikona: "pioro" },
];

/**
 * Rozdroże kasyna: saldo i trzy równorzędne gry (spec wyglądu, „Kasyno”).
 * Wcześniej sloty leżały tu wprost, a pozostałe gry były odnośnikami -
 * hierarchia była nierówna, choć gry są na tym samym poziomie.
 */
export default async function ArcadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: wynik }, pula] = await Promise.all([
    supabase.from("user_scores").select("*").eq("user_id", user.id).maybeSingle(),
    wczytajPule(supabase),
  ]);
  const saldo = (wynik as UserScore | null)?.score ?? 0;

  return (
    <Ekran tytul="Kasyno" podtytul="Gra z puli drużyny">
      <KartaPuli pula={pula} saldo={saldo} />

      <nav className="grid gap-2.5">
        {GRY.map((g) => (
          <PozycjaMenu key={g.href} href={g.href} ikona={g.ikona} nazwa={g.nazwa} opis={g.opis} />
        ))}
      </nav>

      <Wroc href="/app/wiecej">Wróć</Wroc>
    </Ekran>
  );
}
