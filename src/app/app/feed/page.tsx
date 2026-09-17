import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wpis, type KomentarzWpis } from "./Wpis";

type WpisSurowy = {
  id: string;
  photo_path: string;
  caption: string | null;
  created_at: string;
  bingo_tasks: { title: string; points: number } | null;
  teams: { name: string; color: string } | null;
  profiles: { display_name: string | null } | null;
};

type KomentarzSurowy = {
  id: string;
  submission_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

/** Ekran awarii odczytu — celowo mówi, że to usterka, a nie stan feedu. */
function Awaria({ co }: { co: string }) {
  return (
    <Ekran tytul="Feed" podtytul="Zaakceptowane dowody">
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
        Nie udało się wczytać {co}. To usterka po naszej stronie, nie Twoja —
        spróbuj odświeżyć za chwilę.
      </p>
    </Ekran>
  );
}

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną. W Next 16 ta opcja i tak znika przy Cache Components.
export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Bramka w middleware już to gwarantuje, ale strona ma stać samodzielnie,
  // gdyby kiedyś trafiła tu inna ścieżka.
  if (!user) redirect("/wejscie");

  const { data: profil, error: bladProfilu } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  // Rola decyduje wyłącznie o tym, czy klient pokaże przycisk kasowania
  // cudzego komentarza — samo kasowanie i tak pilnuje RLS po stronie bazy.
  // Awaria tego odczytu nie blokuje feedu: bez roli po prostu nie zobaczymy
  // przycisku admina, co jest bezpiecznym (nie uprzywilejowanym) domyślnym
  // stanem, więc dostaje log, a nie cały ekran awarii.
  if (bladProfilu) {
    console.error("Nie udało się wczytać profilu na feedzie:", bladProfilu);
  }
  const jestAdminem = profil?.role === "admin";
  const mojeImie = profil?.display_name ?? "Uczestnik";

  // Uwaga: `bingo_submissions` ma dwa klucze obce do `profiles` (`user_id`
  // i `reviewed_by`) — samo `profiles(display_name)` kończy się PGRST201.
  // Relację trzeba wskazać jawnie po nazwie klucza obcego.
  const { data: wpisyRaw, error: bladWpisow } = await supabase
    .from("bingo_submissions")
    .select(
      "id, photo_path, caption, created_at, " +
        "bingo_tasks(title, points), teams(name, color), " +
        "profiles!bingo_submissions_user_id_fkey(display_name)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // Cicho połknięty błąd renderuje pusty feed i wygląda jak brak treści —
  // stąd osobny ekran awarii zamiast lądowania na pustej liście niżej.
  if (bladWpisow) {
    console.error("Nie udało się wczytać feedu:", bladWpisow);
    return <Awaria co="feedu" />;
  }

  const wpisy = (wpisyRaw ?? []) as unknown as WpisSurowy[];

  if (wpisy.length === 0) {
    return (
      <Ekran tytul="Feed" podtytul="Zaakceptowane dowody">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Tu wylądują zdjęcia z bingo, kiedy tylko ktoś zacznie je wrzucać.
        </p>
      </Ekran>
    );
  }

  const ids = wpisy.map((w) => w.id);

  // Podpisane URL-e do zdjęć oraz lajki i komentarze pobieramy równolegle,
  // jak w kolejce zgłoszeń — sekwencyjnie byłoby to widoczne gołym okiem.
  // Przy 65 osobach i jednym lajku na osobę liczba wierszy jest mała, więc
  // pobieramy wszystkie lajki wpisów i liczymy je po stronie klienta zamiast
  // dociągać osobny `count` na każdy wpis.
  const [podgladyPary, { data: lajkiRaw, error: bladLajkow }, { data: komentarzeRaw, error: bladKomentarzy }] =
    await Promise.all([
      Promise.all(
        wpisy.map(async (w) => {
          const { data } = await supabase.storage
            .from("bingo")
            .createSignedUrl(w.photo_path, 3600);
          return [w.id, data?.signedUrl ?? null] as const;
        }),
      ),
      supabase.from("feed_likes").select("submission_id, user_id").in("submission_id", ids),
      supabase
        .from("feed_comments")
        .select(
          "id, submission_id, user_id, body, created_at, " +
            "profiles!feed_comments_user_id_fkey(display_name)",
        )
        .in("submission_id", ids)
        .order("created_at", { ascending: true }),
    ]);

  if (bladLajkow) {
    console.error("Nie udało się wczytać lajków feedu:", bladLajkow);
    return <Awaria co="lajków" />;
  }
  if (bladKomentarzy) {
    console.error("Nie udało się wczytać komentarzy feedu:", bladKomentarzy);
    return <Awaria co="komentarzy" />;
  }

  const podglady = new Map(podgladyPary);

  const lajkiByWpis = new Map<string, string[]>();
  for (const l of (lajkiRaw ?? []) as { submission_id: string; user_id: string }[]) {
    const lista = lajkiByWpis.get(l.submission_id) ?? [];
    lista.push(l.user_id);
    lajkiByWpis.set(l.submission_id, lista);
  }

  const komentarzeByWpis = new Map<string, KomentarzWpis[]>();
  for (const k of (komentarzeRaw ?? []) as unknown as KomentarzSurowy[]) {
    const lista = komentarzeByWpis.get(k.submission_id) ?? [];
    lista.push({
      id: k.id,
      userId: k.user_id,
      tresc: k.body,
      createdAt: k.created_at,
      autor: k.profiles?.display_name ?? "Uczestnik",
    });
    komentarzeByWpis.set(k.submission_id, lista);
  }

  return (
    <Ekran tytul="Feed" podtytul="Zaakceptowane dowody">
      <ul className="grid gap-6">
        {wpisy.map((w) => (
          <li key={w.id}>
            <Wpis
              id={w.id}
              zdjecieUrl={podglady.get(w.id) ?? null}
              podpis={w.caption}
              utworzonoIso={w.created_at}
              utworzonoTekst={new Date(w.created_at).toLocaleString("pl-PL", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              zadanieTytul={w.bingo_tasks?.title ?? "Zadanie"}
              punkty={w.bingo_tasks?.points ?? 0}
              druzynaNazwa={w.teams?.name ?? "Bez drużyny"}
              druzynaKolor={w.teams?.color ?? "#9c8b8e"}
              autor={w.profiles?.display_name ?? "Uczestnik"}
              userId={user.id}
              mojeImie={mojeImie}
              isAdmin={jestAdminem}
              initialLikes={lajkiByWpis.get(w.id) ?? []}
              initialComments={komentarzeByWpis.get(w.id) ?? []}
            />
          </li>
        ))}
      </ul>
    </Ekran>
  );
}
