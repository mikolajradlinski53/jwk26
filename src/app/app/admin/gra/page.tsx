import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import { Questy, type QuestAdmina } from "./Questy";

/**
 * Zadania gry terenowej. Admin dodaje je zawczasu jako nieodkryte i odkrywa
 * w trakcie wyjazdu - odkrycie wysyła push do wszystkich przyjętych.
 * Zgłoszenia drużyn rozpatruje się w kolejce bingo.
 */
export default async function GraAdminPage() {
  const supabase = await createClient();
  const [{ data: zadania, error }, { data: zgloszenia }] = await Promise.all([
    supabase
      .from("bingo_tasks")
      .select("id, title, description, points, odkryte, active, created_at")
      .eq("rodzaj", "quest")
      .order("created_at", { ascending: true }),
    supabase.from("bingo_submissions").select("task_id, status"),
  ]);

  if (error) {
    console.error("Nie udało się wczytać zadań gry terenowej (admin):", error);
    return (
      <Ekran tytul="Gra terenowa" podtytul="Zadania dla drużyn">
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać zadań. Odśwież stronę.
        </p>
        <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
      </Ekran>
    );
  }

  const licznik = new Map<string, { wszystkie: number; zaliczone: number }>();
  for (const z of (zgloszenia ?? []) as { task_id: string; status: string }[]) {
    const l = licznik.get(z.task_id) ?? { wszystkie: 0, zaliczone: 0 };
    l.wszystkie += 1;
    if (z.status === "approved") l.zaliczone += 1;
    licznik.set(z.task_id, l);
  }

  const questy: QuestAdmina[] = ((zadania ?? []) as Omit<QuestAdmina, "zgloszen" | "zaliczonych">[]).map((z) => ({
    ...z,
    zgloszen: licznik.get(z.id)?.wszystkie ?? 0,
    zaliczonych: licznik.get(z.id)?.zaliczone ?? 0,
  }));

  return (
    <Ekran tytul="Gra terenowa" podtytul="Zadania dla drużyn">
      <Questy questy={questy} />
      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
