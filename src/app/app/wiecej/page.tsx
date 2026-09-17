import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Button } from "@/components/ui/Button";
import type { UserScore } from "@/types/db";

export default async function WiecejPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profil }, { data: wynik }] = await Promise.all([
    supabase.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("user_scores").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const mojWynik = wynik as UserScore | null;
  const jestAdminem = profil?.role === "admin";

  return (
    <Ekran tytul="Więcej" podtytul={profil?.display_name ?? undefined}>
      <div className="szklo mb-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">
          {mojWynik?.team_name ?? "Bez drużyny"}
        </span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">
          {mojWynik?.score ?? 0}
        </strong>
      </div>

      <nav className="grid gap-2.5">
        {jestAdminem && (
          <Link
            href="/app/admin"
            className="szklo flex min-h-12 items-center rounded-md px-4 text-sm font-bold
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
          >
            Sanktuarium
          </Link>
        )}
        <p className="px-1 text-xs leading-relaxed text-dym">
          Kasyno i gossipy zamieszkają tutaj, kiedy powstaną.
        </p>
      </nav>

      <form action="/auth/signout" method="post" className="mt-8">
        <Button variant="cichy" type="submit">
          Opuść sektę
        </Button>
      </form>
    </Ekran>
  );
}
