import type { SupabaseClient } from "@supabase/supabase-js";
import { Ekran } from "@/components/Ekran";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import { Przelacznik } from "../bingo/Przelacznik";
import { Zadania } from "./Zadania";
import type { BingoSubmission, BingoTask } from "@/types/db";

/**
 * Gra terenowa - widok w zakładce Bingo: mapa z pinezkami odkrytych zadań
 * i ich karty. Każda drużyna wysyła jedno zgłoszenie (zdjęcie + opis), punkty
 * po akceptacji. Pod spodem te same tabele co bingo (rodzaj 'quest').
 */
export async function WidokGry({
  supabase,
  userId,
  teamId,
  rola,
}: {
  supabase: SupabaseClient;
  userId: string;
  teamId: string | null;
  rola: string | null;
}) {
  const podglad = !teamId && rola === "admin";

  // Tylko odkryte i aktywne - admin widzi tu to samo co uczestnicy;
  // nieodkryte ma w panelu. Kolejność dodania = kolejność na trasie
  // (numery pinezek i kart), jak w panelu admina.
  const [{ data: zadaniaRaw, error: bladZadan }, { data: zgloszeniaRaw, error: bladZgloszen }] =
    await Promise.all([
      supabase
        .from("bingo_tasks")
        .select("*")
        .eq("rodzaj", "quest")
        .eq("odkryte", true)
        .eq("active", true)
        .order("created_at", { ascending: true }),
      teamId
        ? supabase.from("bingo_submissions").select("*").eq("team_id", teamId).not("task_id", "is", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (bladZadan || bladZgloszen) {
    console.error("Nie udało się wczytać gry terenowej:", bladZadan ?? bladZgloszen);
    return (
      <Ekran tytul="Gra terenowa" podtytul="Zadania dla drużyn">
        <Przelacznik aktywny="gra" />
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
          Nie udało się wczytać zadań. To usterka po naszej stronie - odśwież za chwilę.
        </p>
      </Ekran>
    );
  }

  const zadania = (zadaniaRaw ?? []) as BingoTask[];

  return (
    <Ekran tytul="Gra terenowa" podtytul="Zadania dla drużyn">
      <Przelacznik aktywny="gra" />
      {!teamId && !podglad ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Nie masz przypisanej drużyny. Zadania pojawią się, kiedy Organizator Cię do niej przypisze.
        </p>
      ) : zadania.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm leading-relaxed text-dym">
          Żadne zadanie nie zostało jeszcze odkryte. Organizator odsłania je w trakcie wyjazdu -
          dostaniesz powiadomienie.
        </p>
      ) : (
        <>
          <Zasady zadania={zadania} />
          <Zadania
            zadania={zadania}
            zgloszenia={(zgloszeniaRaw ?? []) as BingoSubmission[]}
            userId={userId}
            teamId={teamId ?? ""}
            podglad={podglad}
          />
        </>
      )}
      {/* Nowe zadania odkrywa organizator - po powrocie do apki lista ma być
          świeża; przycisk na dole, żeby nie zasłaniał zadań. */}
      <div className="mt-5">
        <OdswiezPrzyPowrocie />
      </div>
    </Ekran>
  );
}

/** Zasady nad mapą: liczby z odkrytych zadań, żeby nie rozjechały się z planszą. */
function Zasady({ zadania }: { zadania: BingoTask[] }) {
  const razem = zadania.reduce((s, z) => s + z.points, 0);
  return (
    <section aria-label="Zasady gry terenowej" className="szklo mb-3 rounded-md px-4 py-4">
      <h2 className="font-tytul text-lg leading-tight text-kosc">Trasa po Karpaczu</h2>
      <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-kosc/85">
        <li>
          {zadania.length} {zadania.length === 1 ? "punkt" : zadania.length < 5 ? "punkty" : "punktów"} na mapie,
          start i meta przy ośrodku. Numery to proponowana kolejność - możecie iść, jak chcecie.
        </li>
        <li>Przy każdym punkcie zróbcie zdjęcie całą drużyną tak, żeby było widać miejsce.</li>
        <li>Zdjęcie wysyła jedna osoba w karcie punktu. Punkty wpadają drużynie po akceptacji Organizatora.</li>
      </ul>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-krew-jasna">Do zdobycia: {razem} pkt</p>
    </section>
  );
}
