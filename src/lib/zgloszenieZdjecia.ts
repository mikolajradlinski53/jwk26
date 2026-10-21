import { createClient } from "@/lib/supabase/client";
import { podglad, skompresuj } from "@/lib/obrazy";

/** Ścieżka podglądu (720 px) obok pełnego pliku. */
export function sciezkaPodgladu(sciezka: string): string {
  return sciezka.replace(/\.jpg$/, ".podglad.jpg");
}

/**
 * Zdjęcie do feedu: kompresja, upload pełnego pliku i podglądu, potem wiersz
 * w bingo_submissions. `taskId` = pole bingo albo zadanie gry terenowej;
 * `null` = swobodny post (od razu w feedzie, bez punktów, 2026-10-21).
 */
export async function wyslijZdjecieZadania(o: {
  userId: string;
  teamId: string;
  taskId: string | null;
  plik: File;
  podpis: string;
  etap: (opis: string) => void;
}): Promise<void> {
  const supabase = createClient();
  o.etap("Przygotowuję zdjęcie...");
  const zmniejszone = await skompresuj(o.plik);

  o.etap("Wysyłam zdjęcie...");
  const sciezka = `${o.userId}/${crypto.randomUUID()}.jpg`;
  const { error: bladUploadu } = await supabase.storage
    .from("bingo")
    .upload(sciezka, zmniejszone, { contentType: "image/jpeg" });
  if (bladUploadu) throw bladUploadu;

  // Podgląd do feedu obok pełnego pliku. Porażka nie psuje zgłoszenia -
  // trasa zdjęć odda wtedy pełne (spec porządku, D6).
  try {
    const maly = await podglad(o.plik);
    const { error: bladPodgladu } = await supabase.storage
      .from("bingo")
      .upload(sciezkaPodgladu(sciezka), maly, { contentType: "image/jpeg" });
    if (bladPodgladu) throw bladPodgladu;
  } catch (e) {
    console.error("Podgląd zdjęcia się nie wysłał:", e);
  }

  o.etap(o.taskId ? "Zapisuję zgłoszenie..." : "Publikuję...");
  const { error } = await supabase.from("bingo_submissions").insert({
    team_id: o.teamId,
    user_id: o.userId,
    task_id: o.taskId,
    photo_path: sciezka,
    caption: o.podpis.trim() || null,
    // Post nie czeka w kolejce - polityka posty_insert_own wymaga `approved`.
    ...(o.taskId ? {} : { status: "approved" }),
  });
  if (error) throw error;
}

/**
 * Błąd techniczny → zdanie, z którym uczestnik ma co zrobić. `zajete` to
 * komunikat na wypadek, gdy ktoś z drużyny był szybszy (unikalny indeks).
 */
export function komunikatZdjecia(e: unknown, zajete: string): string {
  const tekst = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);

  if (/bingo_jedno_na_pole|duplicate key/i.test(tekst)) return zajete;
  if (/POSTY_LIMIT/.test(tekst)) return "Za dużo zdjęć w ostatniej godzinie. Odpocznij chwilę i wrzuć później.";
  if (/row-level security|jwt|expired|401/i.test(tekst)) {
    return "Sesja wygasła albo zadanie jest już zamknięte. Odśwież i spróbuj jeszcze raz.";
  }
  if (/mime type|not supported/i.test(tekst)) {
    return "Ten format zdjęcia nie przechodzi. Spróbuj innego pliku.";
  }
  if (/failed to fetch|networkerror|network/i.test(tekst)) {
    return "Zerwało połączenie. Sprawdź zasięg i spróbuj jeszcze raz.";
  }
  if (/image|decode|canvas|load/i.test(tekst)) {
    return "Nie udało się odczytać tego pliku jako zdjęcia. Spróbuj innego.";
  }
  return "Coś poszło nie tak. Spróbuj jeszcze raz.";
}
