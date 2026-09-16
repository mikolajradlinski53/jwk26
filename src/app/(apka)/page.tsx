import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Button } from "@/components/ui/Button";
import type { TeamScore } from "@/types/db";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bramka nie wpuści tu niezalogowanego, ale token może wygasnąć między jej
  // sprawdzeniem a tym renderem. Lepsze przekierowanie niż 500.
  if (!user) redirect("/login");

  const [{ data }, { data: profil }] = await Promise.all([
    supabase.from("team_scores").select("*").order("score", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const wyniki = (data ?? []) as TeamScore[];
  // Odnośnik tylko dla admina — bramka i tak nie wpuści nikogo innego na /admin,
  // ale pokazywanie wszystkim linku, który odbija, jest zwyczajnie mylące.
  const jestAdminem = profil?.role === "admin";

  return (
    <Ekran tytul="Ranking Sekt">
      <ol className="grid gap-2">
        {wyniki.map((w, i) => (
          <li
            key={w.team_id}
            className="flex items-center justify-between border-l-4 bg-ash/60 px-4 py-3"
            style={{ borderLeftColor: w.color }}
          >
            <span className="font-display tracking-wider">
              <span className="text-smoke">#{i + 1}</span> {w.name}
            </span>
            <strong className="text-candle">{w.score}</strong>
          </li>
        ))}
      </ol>

      {jestAdminem && (
        <Link
          href="/admin"
          className="mt-8 flex min-h-11 items-center justify-center border
                     border-candle/40 px-4 font-display text-sm uppercase
                     tracking-widest text-candle hover:bg-candle/10"
        >
          Sanktuarium
        </Link>
      )}

      <form action="/auth/signout" method="post" className="mt-4">
        <Button variant="cichy" type="submit" className="w-full">
          Opuść sektę
        </Button>
      </form>
    </Ekran>
  );
}
