import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { przeczytajDowod, type WynikOcr } from "@/lib/ocr/run";

export type WgranyDowod = { sciezka: string; ocr: WynikOcr | null };

/**
 * Kompresja, upload do prywatnego `proofs`, OCR. Wspólne dla formularza
 * i dopłaty po awansie z rezerwy — dwie kopie rozjechałyby się przy
 * pierwszej poprawce.
 *
 * Kolejność ma znaczenie: OCR po uploadzie, bo jego awaria nie może
 * zablokować zgłoszenia (D4 speca głównego), a zdjęcie w buckecie już jest.
 */
export async function wgrajDowod(
  plik: File,
  etap: (opis: string) => void,
): Promise<WgranyDowod> {
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

  etap("Odczytuję przelew...");
  const ocr = await przeczytajDowod(zmniejszone);

  return { sciezka, ocr };
}

/** Pola OCR w kształcie parametrów zloz_zgloszenie i dolacz_przelew. */
export function polaOcr(d: WgranyDowod | null) {
  return {
    p_ocr_text: d?.ocr?.tekst ?? null,
    p_ocr_confidence: d?.ocr?.pewnosc ?? null,
    p_ocr_keywords_hit: d?.ocr?.trafienia.length ?? 0,
  };
}
