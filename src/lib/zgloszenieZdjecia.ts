import { createClient } from "@/lib/supabase/client";
import { podglad, skompresuj } from "@/lib/obrazy";
import { FILM_MAX_MB, FILM_MAX_SEKUND, rozszerzenieFilmu, sciezkaPodgladu } from "@/lib/media";

export { FILM_MAX_MB, FILM_MAX_SEKUND, jestFilm, rozszerzenieFilmu, sciezkaPodgladu } from "@/lib/media";

/**
 * Długość filmu i okładka z klatki ok. 0,3 s (720 px, JPEG). Okładka jest
 * „najlepszym wysiłkiem” - przeglądarka, która nie odda klatki (bywa na
 * starszych iPhone'ach), daje null i feed pokaże kafel z ikoną odtwarzania.
 */
async function zbadajFilm(plik: File): Promise<{ sekundy: number; okladka: Blob | null }> {
  const url = URL.createObjectURL(plik);
  const film = document.createElement("video");
  film.muted = true;
  film.playsInline = true;
  film.preload = "auto";
  film.src = url;
  try {
    await new Promise<void>((ok, blad) => {
      film.onloadedmetadata = () => ok();
      film.onerror = () => blad(new Error("decode: nie udało się odczytać filmu"));
    });
    const sekundy = film.duration;
    let okladka: Blob | null = null;
    try {
      await new Promise<void>((ok, blad) => {
        const t = window.setTimeout(() => blad(new Error("timeout klatki")), 4000);
        film.onseeked = () => {
          window.clearTimeout(t);
          ok();
        };
        film.currentTime = Math.min(0.3, Number.isFinite(sekundy) ? sekundy / 2 : 0.3);
      });
      const skala = Math.min(1, 720 / Math.max(film.videoWidth, film.videoHeight, 1));
      const plotno = document.createElement("canvas");
      plotno.width = Math.round(film.videoWidth * skala);
      plotno.height = Math.round(film.videoHeight * skala);
      plotno.getContext("2d")?.drawImage(film, 0, 0, plotno.width, plotno.height);
      okladka = await new Promise<Blob | null>((ok) => plotno.toBlob(ok, "image/jpeg", 0.75));
    } catch (e) {
      console.error("Okładka filmu się nie zrobiła:", e);
    }
    return { sekundy, okladka };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Zdjęcie albo krótki film do feedu: upload pełnego pliku i podglądu/okładki,
 * potem wiersz w bingo_submissions. `taskId` = pole bingo albo zadanie gry
 * terenowej; `null` = swobodny post (od razu w feedzie, bez punktów).
 * Zdjęcie jest kompresowane; film idzie w oryginale (do 30 s i 50 MB).
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
  let sciezka: string;

  if (o.plik.type.startsWith("video/")) {
    const rozszerzenie = rozszerzenieFilmu(o.plik.type);
    if (!rozszerzenie) throw new Error("FILM_FORMAT");
    if (o.plik.size > FILM_MAX_MB * 1024 * 1024) throw new Error("FILM_ZA_DUZY");
    o.etap("Sprawdzam film...");
    const { sekundy, okladka } = await zbadajFilm(o.plik);
    if (Number.isFinite(sekundy) && sekundy > FILM_MAX_SEKUND + 0.5) throw new Error("FILM_ZA_DLUGI");

    o.etap("Wysyłam film...");
    sciezka = `${o.userId}/${crypto.randomUUID()}.${rozszerzenie}`;
    const { error: bladUploadu } = await supabase.storage
      .from("bingo")
      .upload(sciezka, o.plik, { contentType: o.plik.type });
    if (bladUploadu) throw bladUploadu;

    if (okladka) {
      const { error: bladOkladki } = await supabase.storage
        .from("bingo")
        .upload(sciezkaPodgladu(sciezka), okladka, { contentType: "image/jpeg" });
      if (bladOkladki) console.error("Okładka filmu się nie wysłała:", bladOkladki);
    }
  } else {
    o.etap("Przygotowuję zdjęcie...");
    const zmniejszone = await skompresuj(o.plik);

    o.etap("Wysyłam zdjęcie...");
    sciezka = `${o.userId}/${crypto.randomUUID()}.jpg`;
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
  if (/FILM_ZA_DLUGI/.test(tekst)) return `Film może mieć najwyżej ${FILM_MAX_SEKUND} sekund. Przytnij go i spróbuj jeszcze raz.`;
  if (/FILM_ZA_DUZY|exceeded the maximum allowed size|Payload too large|413/i.test(tekst)) {
    return `Film jest za duży (limit ${FILM_MAX_MB} MB). Nagraj krótszy albo w niższej jakości.`;
  }
  if (/FILM_FORMAT/.test(tekst)) return "Ten format filmu nie przechodzi. Spróbuj MP4 albo MOV.";
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
