import { createClient } from "@/lib/supabase/client";
import { podglad, skompresuj } from "@/lib/obrazy";

/**
 * Zdjęcie do zadania drużyny - pole bingo albo zadanie gry terenowej (oba
 * siedzą w bingo_tasks/bingo_submissions). Kompresja, upload, podgląd do
 * feedu i wiersz zgłoszenia. Wspólne dla planszy i gry terenowej.
 */
export async function wyslijZdjecieZadania(o: {
  userId: string;
  teamId: string;
  taskId: string;
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
      .upload(sciezka.replace(/\.jpg$/, ".podglad.jpg"), maly, { contentType: "image/jpeg" });
    if (bladPodgladu) throw bladPodgladu;
  } catch (e) {
    console.error("Podgląd zdjęcia się nie wysłał:", e);
  }

  o.etap("Zapisuję zgłoszenie...");
  const { error } = await supabase.from("bingo_submissions").insert({
    team_id: o.teamId,
    user_id: o.userId,
    task_id: o.taskId,
    photo_path: sciezka,
    caption: o.podpis.trim() || null,
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
