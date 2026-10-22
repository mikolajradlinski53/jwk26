import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Plansza } from "./Plansza";
import { Przelacznik } from "./Przelacznik";
import { WidokGry } from "../gra/WidokGry";
import type { BingoSubmission, BingoTask } from "@/types/db";
import { POLE_DARMOWE } from "@/lib/bingo";

/** Zasady nad planszą (decyzja Mikołaja 2026-10-21): linie tylko w pionie i poziomie. */
function ZasadyBingo({
  zaPole,
  wygrana,
  kumulacja,
  zwyciezca,
}: {
  zaPole: number | null;
  wygrana: number | null;
  kumulacja: number | null;
  zwyciezca: string | null;
}) {
  const pkt = (n: number | null) => (n === null ? "" : ` - ${n} pkt`);
  return (
    <section aria-label="Zasady bingo" className="szklo mb-3 rounded-md px-4 py-3.5">
      <ul className="grid gap-1 text-sm leading-relaxed text-kosc/85">
        <li>
          <b className="text-kosc">Wygrana: 3 linie</b> (pion lub poziom){pkt(wygrana)} dla pierwszej drużyny.
          {zwyciezca && <span className="text-krew-jasna"> Zdobyta: {zwyciezca}.</span>}
        </li>
        <li>
          <b className="text-kosc">Kumulacja: wszystkie pola</b>
          {pkt(kumulacja)}.
        </li>
        <li>
          <b className="text-kosc">Punkty za każde pole</b>
          {pkt(zaPole)}. Środek jest darmowy.
        </li>
        <li>
          <b className="text-kosc">Każde pole musi zostać udokumentowane</b> - zdjęciem w polu planszy.
        </li>
      </ul>
    </section>
  );
}

/** Ekran awarii odczytu - celowo mówi, że to usterka, a nie stan gry. */
function Awaria({ co }: { co: string }) {
  return (
    <Ekran tytul="Bingo" podtytul="Plansza drużyny">
      <Przelacznik aktywny="bingo" />
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
        Nie udało się wczytać {co}. To usterka po naszej stronie, nie Twoja -
        spróbuj odświeżyć za chwilę.
      </p>
    </Ekran>
  );
}

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną. W Next 16 ta opcja i tak znika przy Cache Components.
export default async function BingoPage({ searchParams }: { searchParams: Promise<{ widok?: string }> }) {
  const [supabase, { widok }] = await Promise.all([createClient(), searchParams]);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Bramka w middleware już to gwarantuje, ale strona ma stać samodzielnie,
  // gdyby kiedyś trafiła tu inna ścieżka.
  if (!user) redirect("/wejscie");

  const { data: profil, error: bladProfilu } = await supabase
    .from("profiles")
    .select("team_id, role")
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

  if (widok === "gra") {
    return <WidokGry supabase={supabase} userId={user.id} teamId={profil?.team_id ?? null} rola={profil?.role ?? null} />;
  }

  // Organizator bez drużyny widzi samą planszę, bez zgłoszeń (2026-10-12).
  if (!profil?.team_id && profil?.role === "admin") {
    const { data: zadaniaRaw } = await supabase.from("bingo_tasks").select("*").eq("rodzaj", "bingo").order("position");
    return (
      <Ekran tytul="Bingo" podtytul="Podgląd Organizatora">
        <Przelacznik aktywny="bingo" />
        <Plansza zadania={(zadaniaRaw ?? []) as BingoTask[]} zgloszenia={[]} userId={user.id} teamId="" podglad />
      </Ekran>
    );
  }

  // Akceptacja przypisuje drużynę, ale admin mógł ją później wyczyścić -
  // to realny, nie tylko teoretyczny stan, więc dostaje własny ekran.
  if (!profil?.team_id) {
    return (
      <Ekran tytul="Bingo" podtytul="Plansza drużyny">
        <Przelacznik aktywny="bingo" />
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Nie masz przypisanej drużyny. Plansza pojawi się, kiedy Organizator
          Cię do niej przypisze.
        </p>
      </Ekran>
    );
  }

  const teamId = profil.team_id;

  const [
    { data: zadaniaRaw, error: bladZadan },
    { data: zgloszeniaRaw, error: bladZgloszen },
    { data: bonusyRaw },
    { data: wygranaRaw },
  ] = await Promise.all([
    // Same pola planszy - zadania gry terenowej mają osobny ekran.
    supabase.from("bingo_tasks").select("*").eq("rodzaj", "bingo").order("position"),
    supabase.from("bingo_submissions").select("*").eq("team_id", teamId).not("task_id", "is", null),
    supabase.from("app_settings").select("key, value").in("key", ["bingo_bonus_wygrana", "bingo_bonus_plansza"]),
    // Wygraną bierze tylko pierwsza drużyna - zasady mówią, czy jeszcze jest do wzięcia.
    supabase.from("points_ledger").select("teams(name)").eq("ref_type", "bingo_wygrana").limit(1),
  ]);

  if (bladZadan) {
    console.error("Nie udało się wczytać zadań bingo:", bladZadan);
    return <Awaria co="planszy" />;
  }
  // Zgłoszenia to stan planszy, nie jej istnienie. Gdy padną, plansza bez nich
  // pokazałaby wszystkie pola jako puste - czyli skłamałaby o stanie gry
  // i skusiła do zgłoszenia pola, które drużyna już zajęła.
  if (bladZgloszen) {
    console.error("Nie udało się wczytać zgłoszeń bingo:", bladZgloszen);
    return <Awaria co="stanu planszy" />;
  }

  const zadania = (zadaniaRaw ?? []) as BingoTask[];
  const zgloszenia = (zgloszeniaRaw ?? []) as BingoSubmission[];
  const bonus = (klucz: string) =>
    Number((bonusyRaw ?? []).find((u: { key: string; value: unknown }) => u.key === klucz)?.value) || null;
  const zwyciezca =
    ((wygranaRaw?.[0] as { teams: { name: string } | { name: string }[] | null } | undefined)?.teams ?? null);
  const nazwaZwyciezcy = Array.isArray(zwyciezca) ? zwyciezca[0]?.name : zwyciezca?.name;

  return (
    <Ekran tytul="Bingo" podtytul="Plansza drużyny">
      <Przelacznik aktywny="bingo" />
      {zadania.length > 0 && (
        <ZasadyBingo
          zaPole={zadania.find((z) => z.position !== POLE_DARMOWE)?.points ?? null}
          wygrana={bonus("bingo_bonus_wygrana")}
          kumulacja={bonus("bingo_bonus_plansza")}
          zwyciezca={nazwaZwyciezcy ?? null}
        />
      )}
      {zadania.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Plansza zapali się razem z pierwszym zadaniem. Do tego czasu punkty
          przyznaje wyłącznie Organizator.
        </p>
      ) : (
        <Plansza zadania={zadania} zgloszenia={zgloszenia} userId={user.id} teamId={teamId} />
      )}
    </Ekran>
  );
}
