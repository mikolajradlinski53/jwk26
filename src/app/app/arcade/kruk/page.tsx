import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Lot } from "./Lot";
import type { KrukMiejsce } from "@/types/db";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { Pusto } from "@/components/Pusto";

function Wiersz({ m, ja }: { m: KrukMiejsce; ja: boolean }) {
  return (
    <li
      className={
        "szklo flex items-center gap-3 rounded-md px-3.5 py-2.5 " + (ja ? "ring-1 ring-krew/60" : "")
      }
    >
      <span className="w-7 flex-none font-tytul text-sm tabular-nums text-dym">{m.miejsce}.</span>
      <span
        aria-hidden
        className="size-2.5 flex-none rounded-full"
        style={{ backgroundColor: m.color ?? "transparent" }}
      />
      <span className="min-w-0 flex-1 truncate text-sm">{m.display_name}</span>
      <span className="flex-none font-tytul text-base tabular-nums">{m.rekord}</span>
    </li>
  );
}

export default async function KrukPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: topRaw }, { data: mojRaw }] = await Promise.all([
    supabase
      .from("kruk_ranking")
      .select("*")
      .order("miejsce")
      .order("display_name")
      .limit(10),
    supabase.from("kruk_ranking").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const top = (topRaw ?? []) as KrukMiejsce[];
  const moj = mojRaw as KrukMiejsce | null;
  const mojPozaTop = moj !== null && !top.some((m) => m.user_id === user.id);

  return (
    <Ekran tytul="Kruk" podtytul="Przeleć między kolumnami - bez punktów, o sławę">
      <Lot rekordPoczatkowy={moj?.rekord ?? null} />

      <div className="szklo mt-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Twój rekord</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">
          {moj ? `${moj.rekord} · ${moj.miejsce}. miejsce` : "-"}
        </strong>
      </div>

      <NaglowekSekcji>Ranking</NaglowekSekcji>
      {top.length === 0 ? (
        <Pusto ikona="pioro">Nikt jeszcze nie przeleciał ani jednej kolumny.</Pusto>
      ) : (
        <ol className="grid gap-1.5">
          {top.map((m) => (
            <Wiersz key={m.user_id} m={m} ja={m.user_id === user.id} />
          ))}
          {moj && mojPozaTop && <Wiersz m={moj} ja />}
        </ol>
      )}

      <Wroc href="/app/arcade">Wróć do kasyna</Wroc>
    </Ekran>
  );
}
