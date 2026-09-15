import { trafioneSlowa, type SlowoKluczowe } from "./score";

export type WynikOcr = {
  tekst: string;
  /** Pewność Tesseracta sprowadzona do zakresu 0–1. */
  pewnosc: number;
  trafienia: SlowoKluczowe[];
};

/**
 * Czyta zdjęcie dowodu przelewu w przeglądarce.
 *
 * Zwraca `null`, gdy cokolwiek pójdzie nie tak — i to jest celowe. Decyzja D4
 * ze speca mówi, że OCR jest podpowiedzią dla admina, a nie sędzią; awaria
 * rozpoznawania nie może zablokować komuś wejścia na wyjazd.
 */
export async function przeczytajDowod(plik: File): Promise<WynikOcr | null> {
  // Import dynamiczny trzyma kilkadziesiąt megabajtów wasm poza wejściowym
  // bundlem — pobierają się dopiero przy wysyłce formularza.
  const { createWorker } = await import("tesseract.js");

  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    // Polski model: potwierdzenia przelewów z polskich banków są po polsku.
    worker = await createWorker("pol");
    const { data } = await worker.recognize(plik);
    return {
      tekst: data.text,
      // Przycięcie do zakresu nie jest paranoją. Wartość spoza 0–1 nie trafiłaby
      // do catch poniżej — poleciałaby dalej i odbiła się od `check` na kolumnie
      // ocr_confidence, wywracając cały insert zgłoszenia. Czyli awaria OCR
      // zablokowałaby rejestrację, dokładnie wbrew D4.
      pewnosc: Math.max(0, Math.min(1, data.confidence / 100)),
      trafienia: trafioneSlowa(data.text),
    };
  } catch (e) {
    // Zgłoszenie idzie dalej bez OCR, ale ślad musi zostać: bez tego panel
    // admina pokazuje „0 słów kluczowych" identycznie dla awarii i dla zdjęcia,
    // na którym po prostu nic nie znaleziono.
    console.error("OCR dowodu przelewu nie powiódł się:", e);
    return null;
  } finally {
    await worker?.terminate();
  }
}
