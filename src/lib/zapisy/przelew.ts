import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { przeczytajDowod, type WynikOcr } from "@/lib/ocr/run";

export type WgranyDowod = { sciezka: string; ocr: WynikOcr | null };
/** Zdjęcie w buckecie, jeszcze bez OCR - formularz czyta je dopiero po zajęciu miejsca. */
export type WgraneZdjecie = { sciezka: string; zmniejszone: File };

/**
 * Kompresja i upload do prywatnego `proofs`. Wspólne dla formularza
 * i dopłaty po awansie z rezerwy - dwie kopie rozjechałyby się przy
 * pierwszej poprawce.
 */
export async function wgrajZdjecie(
  plik: File,
  etap: (opis: string) => void,
): Promise<WgraneZdjecie> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("jwt expired");

  etap("Przygotowuję zdjęcie...");
  const zmniejszone = await skompresuj(plik);

  etap("Wysyłam dowód...");
  // Losowa nazwa: dwa podejścia tej samej osoby nie nadpiszą się, a upload
  // bez `upsert` i tak odmówiłby przy kolizji.
  const sciezka = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("proofs")
    .upload(sciezka, zmniejszone, { contentType: "image/jpeg" });
  if (error) throw error;
  return { sciezka, zmniejszone };
}

/**
 * OCR to tylko podpowiedź dla admina (D4) - zdjęcie już wisi w buckecie, więc
 * nie może zablokować zgłoszenia. Przy słabym sygnale ściąganie modelu
 * Tesseracta potrafi wisieć bez końca; po 45 s idziemy dalej bez wyniku,
 * tak jakby OCR się nie udał.
 */
function ocrZLimitem(zmniejszone: File): Promise<WynikOcr | null> {
  return Promise.race([
    przeczytajDowod(zmniejszone),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 45_000)),
  ]);
}

/**
 * Upload i OCR jednym ciągiem - dla dopłaty po awansie z rezerwy, gdzie
 * miejsce jest już przydzielone i nie ma się o co ścigać.
 */
export async function wgrajDowod(
  plik: File,
  etap: (opis: string) => void,
): Promise<WgranyDowod> {
  const { sciezka, zmniejszone } = await wgrajZdjecie(plik, etap);
  etap("Odczytuję przelew...");
  return { sciezka, ocr: await ocrZLimitem(zmniejszone) };
}

/**
 * OCR po złożeniu zgłoszenia, w tle. O 12:00 miejsce zajmuje zloz_zgloszenie,
 * więc czytanie zdjęcia (do 45 s na słabym telefonie) nie może go poprzedzać.
 * Błędy tylko do konsoli - zgłoszenie już jest, a admin i tak ogląda zdjęcie.
 */
export async function dopiszOcr(zdjecie: WgraneZdjecie): Promise<void> {
  try {
    const ocr = await ocrZLimitem(zdjecie.zmniejszone);
    if (!ocr) return;
    const { error } = await createClient().rpc("uzupelnij_ocr", {
      p_proof_path: zdjecie.sciezka,
      ...polaOcr({ sciezka: zdjecie.sciezka, ocr }),
    });
    if (error) console.error("Dopisanie OCR nie przeszło:", { code: error.code, message: error.message });
  } catch (e) {
    console.error("OCR po zgłoszeniu nie powiódł się:", e);
  }
}

/** Pola OCR w kształcie parametrów dolacz_przelew i uzupelnij_ocr. */
export function polaOcr(d: WgranyDowod | null) {
  return {
    // Limit zgodny z CHECK-iem `registrations_ocr_text_dlugosc` w bazie. Bez
    // przycięcia zapis raz odrzucony z tego powodu odbijałby się identycznie
    // przy każdej kolejnej próbie - zdjęcie (i jego OCR) jest już wgrane.
    p_ocr_text: d?.ocr?.tekst?.slice(0, 20000) ?? null,
    p_ocr_confidence: d?.ocr?.pewnosc ?? null,
    p_ocr_keywords_hit: d?.ocr?.trafienia.length ?? 0,
  };
}
