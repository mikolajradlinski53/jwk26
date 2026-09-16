import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Plansza } from "./Plansza";
import type { BingoSubmission, BingoTask } from "@/types/db";

/** Ekran awarii odczytu — celowo mówi, że to usterka, a nie stan gry. */
function Awaria({ co }: { co: string }) {
  return (
    <Ekran tytul="Bingo" podtytul="Plansza drużyny">
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
        Nie udało się wczytać {co}. To usterka po naszej stronie, nie Twoja —
        spróbuj odświeżyć za chwilę.
      </p>
    </Ekran>
  );
}

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

  // Awaria odczytu musi wyglądać inaczej niż pusty wynik. Bez tego rozróżnienia
  // błąd zapytania renderuje komunikat „nie masz drużyny", uczestnik szuka
  // organizatora zamiast odświeżyć, a jedyny ślad problemu zostaje w logach
  // serwera, do których nikt nie zagląda. Tak umarło kiedyś /admin/historia.
  if (bladProfilu) {
    console.error("Nie udało się wczytać profilu na planszy bingo:", bladProfilu);
    return <Awaria co="Twojego profilu" />;
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

  if (bladZadan) {
    console.error("Nie udało się wczytać zadań bingo:", bladZadan);
    return <Awaria co="planszy" />;
  }
  // Zgłoszenia to stan planszy, nie jej istnienie. Gdy padną, plansza bez nich
  // pokazałaby wszystkie pola jako puste — czyli skłamałaby o stanie gry
  // i skusiła do zgłoszenia pola, które drużyna już zajęła.
  if (bladZgloszen) {
    console.error("Nie udało się wczytać zgłoszeń bingo:", bladZgloszen);
    return <Awaria co="stanu planszy" />;
  }

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
