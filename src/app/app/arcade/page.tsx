import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Ikona, type NazwaIkony } from "@/components/Ikona";
import { Wroc } from "@/components/Wroc";
import type { UserScore } from "@/types/db";

const GRY: { href: string; nazwa: string; opis: string; ikona: NazwaIkony }[] = [
  { href: "/app/arcade/sloty", nazwa: "Sloty", opis: "stawka 10 · limit dzienny", ikona: "swieca" },
  { href: "/app/arcade/blackjack", nazwa: "Blackjack", opis: "stawka 10 · 20 · 50", ikona: "karty" },
  { href: "/app/arcade/kruk", nazwa: "Kruk", opis: "ranking, bez punktów", ikona: "pioro" },
];

/**
 * Rozdroże kasyna: saldo i trzy równorzędne gry (spec wyglądu, „Kasyno”).
 * Wcześniej sloty leżały tu wprost, a pozostałe gry były odnośnikami —
 * hierarchia była nierówna, choć gry są na tym samym poziomie.
 */
export default async function ArcadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const { data: wynik } = await supabase
    .from("user_scores")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const saldo = (wynik as UserScore | null)?.score ?? 0;

  return (
    <Ekran tytul="Kasyno" podtytul="Gra przeciwko twojemu saldu">
      <div className="szklo mb-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Twoje saldo</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">{saldo}</strong>
      </div>

      <nav className="grid gap-2.5">
        {GRY.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            transitionTypes={["nav-forward"]}
            className="szklo flex items-center gap-3.5 rounded-md px-4 py-3.5
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
          >
            <Ikona nazwa={g.ikona} className="size-11 flex-none text-kosc" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{g.nazwa}</span>
              <span className="block text-xs text-dym">{g.opis}</span>
            </span>
            <span aria-hidden="true" className="text-dym">
              →
            </span>
          </Link>
        ))}
      </nav>

      <Wroc href="/app/wiecej">Wróć</Wroc>
    </Ekran>
  );
}
