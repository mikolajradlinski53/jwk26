import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { DecyzjaBingo } from "./DecyzjaBingo";

type ZgloszenieSurowe = {
  id: string;
  photo_path: string;
  caption: string | null;
  created_at: string;
  bingo_tasks: { title: string; description: string; points: number } | null;
  teams: { name: string; color: string } | null;
  profiles: { display_name: string | null } | null;
};

/** Ekran awarii odczytu — ten sam pomysł co w feedzie: mówi wprost, że to
 * usterka po naszej stronie, nie stan kolejki. */
function Awaria() {
  return (
    <Ekran tytul="Bingo" podtytul="Zdjęcia do rozpatrzenia">
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
        Nie udało się wczytać kolejki. To usterka po naszej stronie, nie Twoja
        — spróbuj odświeżyć za chwilę.
      </p>
    </Ekran>
  );
}

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną. W Next 16 ta opcja i tak znika przy Cache Components.
export default async function KolejkaBingo() {
  const supabase = await createClient();

  // Uwaga: `bingo_submissions` ma dwa klucze obce do `profiles` (`user_id`
  // i `reviewed_by`) — samo `profiles(display_name)` kończy się PGRST201.
  // Relację trzeba wskazać jawnie po nazwie klucza obcego, tak jak w feedzie.
  const { data: zgloszeniaRaw, error: bladOdczytu } = await supabase
    .from("bingo_submissions")
    .select(
      "id, photo_path, caption, created_at, " +
        "bingo_tasks(title, description, points), teams(name, color), " +
        "profiles!bingo_submissions_user_id_fkey(display_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // Cicho połknięty błąd renderowałby pustą kolejkę i wyglądałby jak dobra
  // wiadomość ("nic nie czeka") — stąd osobny ekran awarii.
  if (bladOdczytu) {
    console.error("Nie udało się wczytać kolejki bingo:", bladOdczytu);
    return <Awaria />;
  }

  const zgloszenia = (zgloszeniaRaw ?? []) as unknown as ZgloszenieSurowe[];

  // Podpisane URL-e powstają przy renderze i żyją godzinę — bucket jest
  // prywatny. Równolegle, jak w kolejce zgłoszeń: sekwencyjne podpisywanie
  // przy kilkudziesięciu zgłoszeniach byłoby widoczne gołym okiem.
  const wpisy = await Promise.all(
    zgloszenia.map(async (z) => {
      const { data } = await supabase.storage
        .from("bingo")
        .createSignedUrl(z.photo_path, 3600);
      return [z.id, data?.signedUrl ?? null] as const;
    }),
  );
  const podglady = new Map(wpisy);

  return (
    <Ekran tytul="Bingo" podtytul="Zdjęcia do rozpatrzenia">
      {zgloszenia.length === 0 && (
        <p className="text-center text-dym">Kolejka pusta.</p>
      )}

      <ul className="grid gap-8">
        {zgloszenia.map((z) => {
          const tytulZadania = z.bingo_tasks?.title ?? "Zadanie";
          const autor = z.profiles?.display_name ?? "Uczestnik";
          const druzyna = z.teams?.name ?? "Bez drużyny";
          const zdjecieUrl = podglady.get(z.id);

          return (
            <li key={z.id} className="szklo rounded-lg overflow-hidden p-4">
              <p className="font-tytul tracking-wider text-kosc">{tytulZadania}</p>
              {z.bingo_tasks?.description && (
                <p className="mt-1 text-sm text-dym">{z.bingo_tasks.description}</p>
              )}
              <p className="mt-2 text-sm text-dym">
                {autor} · <span style={{ color: z.teams?.color }}>{druzyna}</span>
                {z.bingo_tasks && ` · ${z.bingo_tasks.points} pkt za zadanie`}
              </p>
              {z.caption && (
                <p className="mt-2 text-sm text-kosc">{`„${z.caption}”`}</p>
              )}

              {/* Zwykły <img>, nie next/image: podpisany URL wygasa po
                  godzinie, więc optymalizator i tak nie miałby czego
                  cache'ować. */}
              {zdjecieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={zdjecieUrl}
                  alt={`Zdjęcie zgłoszenia do zadania „${tytulZadania}", od ${autor}`}
                  // Bez lazy przeglądarka zleca pobranie wszystkich zdjęć
                  // w kolejce naraz. Admin ogląda je po kolei.
                  loading="lazy"
                  className="mt-3 w-full"
                />
              ) : (
                <p className="mt-3 text-sm text-krew-jasna">Nie udało się wczytać zdjęcia.</p>
              )}

              <DecyzjaBingo zgloszenieId={z.id} />
            </li>
          );
        })}
      </ul>

      <Link
        href="/admin"
        className="mt-8 flex min-h-11 items-center px-4 font-tytul text-sm
                   uppercase tracking-widest text-dym hover:text-kosc"
      >
        ← Sanktuarium
      </Link>
    </Ekran>
  );
}
