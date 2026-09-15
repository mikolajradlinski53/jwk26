import { trafioneSlowa } from "./score";

export type WynikOcr = {
  tekst: string;
  /** Pewność Tesseracta sprowadzona do zakresu 0–1. */
  pewnosc: number;
  trafienia: string[];
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
      pewnosc: data.confidence / 100,
      trafienia: trafioneSlowa(data.text),
    };
  } catch {
    return null;
  } finally {
    await worker?.terminate();
  }
}
