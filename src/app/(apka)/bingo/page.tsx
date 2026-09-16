import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Plansza } from "./Plansza";
import type { BingoSubmission, BingoTask } from "@/types/db";

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną. W Next 16 ta opcja i tak znika przy Cache Components.
export default async function BingoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Bramka w middleware już to gwarantuje, ale strona ma stać samodzielnie,
  // gdyby kiedyś trafiła tu inna ścieżka.
  if (!user) redirect("/login");

  const { data: profil, error: bladProfilu } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .maybeSingle();

  if (bladProfilu) {
    console.error("Nie udało się wczytać profilu na planszy bingo:", bladProfilu);
  }

  // Akceptacja przypisuje drużynę, ale admin mógł ją później wyczyścić —
  // to realny, nie tylko teoretyczny stan, więc dostaje własny ekran.
  if (!profil?.team_id) {
    return (
      <Ekran tytul="Bingo" podtytul="Plansza drużyny">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Nie masz przypisanej drużyny. Plansza pojawi się, kiedy organizator
          Cię do niej przypisze.
        </p>
      </Ekran>
    );
  }

  const teamId = profil.team_id;

  const [{ data: zadaniaRaw, error: bladZadan }, { data: zgloszeniaRaw, error: bladZgloszen }] =
    await Promise.all([
      supabase.from("bingo_tasks").select("*").order("position"),
      supabase.from("bingo_submissions").select("*").eq("team_id", teamId),
    ]);

  if (bladZadan) console.error("Nie udało się wczytać zadań bingo:", bladZadan);
  if (bladZgloszen) console.error("Nie udało się wczytać zgłoszeń bingo:", bladZgloszen);

  const zadania = (zadaniaRaw ?? []) as BingoTask[];
  const zgloszenia = (zgloszeniaRaw ?? []) as BingoSubmission[];

  return (
    <Ekran tytul="Bingo" podtytul="Plansza drużyny">
      {zadania.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Plansza zapali się razem z pierwszym zadaniem. Do tego czasu punkty
          przyznaje wyłącznie Kapłan.
        </p>
      ) : (
        <Plansza zadania={zadania} zgloszenia={zgloszenia} userId={user.id} teamId={teamId} />
      )}
    </Ekran>
  );
}
