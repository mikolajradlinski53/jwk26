import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import { Zadania } from "./Zadania";
import type { BingoSubmission, BingoTask } from "@/types/db";

/**
 * Gra terenowa: zadania odkrywane przez organizatora. Każda drużyna wysyła
 * jedno zgłoszenie (zdjęcie + opis), punkty po akceptacji. Pod spodem te same
 * tabele co bingo (rodzaj 'quest'), więc zgłoszenia lecą też do feedu.
 */
export default async function GraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const { data: profil } = await supabase.from("profiles").select("team_id").eq("id", user.id).maybeSingle();

  // Tylko odkryte i aktywne - admin widzi tu to samo co uczestnicy;
  // nieodkryte ma w panelu.
  const [{ data: zadaniaRaw, error: bladZadan }, { data: zgloszeniaRaw, error: bladZgloszen }] =
    await Promise.all([
      supabase
        .from("bingo_tasks")
        .select("*")
        .eq("rodzaj", "quest")
        .eq("odkryte", true)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      profil?.team_id
        ? supabase.from("bingo_submissions").select("*").eq("team_id", profil.team_id)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (bladZadan || bladZgloszen) {
    console.error("Nie udało się wczytać gry terenowej:", bladZadan ?? bladZgloszen);
    return (
      <Ekran tytul="Gra terenowa" podtytul="Zadania dla drużyn">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
          Nie udało się wczytać zadań. To usterka po naszej stronie - odśwież za chwilę.
        </p>
      </Ekran>
    );
  }

  const zadania = (zadaniaRaw ?? []) as BingoTask[];

  return (
    <Ekran tytul="Gra terenowa" podtytul="Zadania dla drużyn">
      {!profil?.team_id ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Nie masz przypisanej drużyny. Zadania pojawią się, kiedy organizator Cię do niej przypisze.
        </p>
      ) : zadania.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm leading-relaxed text-dym">
          Żadne zadanie nie zostało jeszcze odkryte. Organizator odsłania je w trakcie wyjazdu -
          dostaniesz powiadomienie.
        </p>
      ) : (
        <Zadania
          zadania={zadania}
          zgloszenia={(zgloszeniaRaw ?? []) as BingoSubmission[]}
          userId={user.id}
          teamId={profil.team_id}
        />
      )}
      {/* Nowe zadania odkrywa organizator - po powrocie do apki lista ma być
          świeża; przycisk na dole, żeby nie zasłaniał zadań. */}
      <div className="mt-5">
        <OdswiezPrzyPowrocie />
      </div>
    </Ekran>
  );
}
