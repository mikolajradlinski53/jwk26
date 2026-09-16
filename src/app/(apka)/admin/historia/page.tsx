import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";

type Wpis = {
  id: number;
  delta: number;
  category: string;
  reason: string | null;
  created_at: string;
  teams: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

export default async function HistoriaPage() {
  const supabase = await createClient();

  // Zagnieżdżony select korzysta z kluczy obcych points_ledger → teams i profiles.
  const { data } = await supabase
    .from("points_ledger")
    .select("id, delta, category, reason, created_at, teams(name), profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const wpisy = (data ?? []) as unknown as Wpis[];

  return (
    <Ekran tytul="Księga" podtytul="Pięćdziesiąt ostatnich wpisów">
      {wpisy.length === 0 && (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Księga jest pusta.
        </p>
      )}

      <ol className="grid gap-2">
        {wpisy.map((w) => (
          <li key={w.id} className="szklo flex items-baseline gap-3 rounded-md px-3.5 py-3">
            <strong
              className={
                "flex-none font-tytul text-lg leading-none tabular-nums " +
                (w.delta > 0 ? "text-krew-jasna" : "text-dym")
              }
            >
              {w.delta > 0 ? "+" : ""}
              {w.delta}
            </strong>
            <span className="min-w-0 flex-1">
              <span className="block text-sm">
                {w.profiles?.display_name ?? w.teams?.name ?? "—"}
              </span>
              <span className="block text-xs text-dym">{w.reason ?? w.category}</span>
            </span>
            <time
              dateTime={w.created_at}
              className="flex-none text-[0.62rem] tabular-nums text-dym"
            >
              {new Date(w.created_at).toLocaleTimeString("pl-PL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ol>

      <Link
        href="/admin"
        className="mt-7 block text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
      >
        Wróć do sanktuarium
      </Link>
    </Ekran>
  );
}
