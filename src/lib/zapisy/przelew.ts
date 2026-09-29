import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { przeczytajDowod, type WynikOcr } from "@/lib/ocr/run";

export type WgranyDowod = { sciezka: string; ocr: WynikOcr | null };

/**
 * Kompresja, upload do prywatnego `proofs`, OCR. Wspólne dla formularza
 * i dopłaty po awansie z rezerwy - dwie kopie rozjechałyby się przy
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
  // OCR to tylko podpowiedź dla admina (D4) - zdjęcie już wisi w buckecie, więc
  // nie może zablokować zgłoszenia. Przy słabym sygnale ściąganie modelu
  // Tesseracta potrafi wisieć bez końca; po 45 s formularz jedzie dalej bez
  // wyniku, tak jakby OCR się nie udał.
  const ocr = await Promise.race([
    przeczytajDowod(zmniejszone),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 45_000)),
  ]);

  return { sciezka, ocr };
}

/** Pola OCR w kształcie parametrów zloz_zgloszenie i dolacz_przelew. */
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
