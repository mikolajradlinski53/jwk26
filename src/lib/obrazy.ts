/**
 * Zmniejsza zdjęcie przed uploadem. Darmowy Storage w Supabase to 1 GB,
 * a zdjęcie z aparatu telefonu potrafi ważyć 5 MB - przy 60 osobach i bingo
 * w planie 04 oryginały skończyłyby limit w jeden wieczór.
 */
export async function skompresuj(plik: File): Promise<File> {
  // Import dynamiczny: biblioteka jest wyłącznie przeglądarkowa i nie ma jej
  // po co ciągnąć do bundla, dopóki ktoś faktycznie nie wybierze pliku.
  const { default: imageCompression } = await import("browser-image-compression");

  return imageCompression(plik, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}

/**
 * Podgląd do feedu: 720 px, ~60-80 KB. Feed pokazuje podglądy, pełne zdjęcie
 * dopiero po dotknięciu - przy 60 osobach przeglądających feed to różnica
 * rzędu dziesięciu razy w transferze (spec porządku, D6).
 */
export async function podglad(plik: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");

  return imageCompression(plik, {
    maxSizeMB: 0.08,
    maxWidthOrHeight: 720,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}
