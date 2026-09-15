/**
 * Zmniejsza zdjęcie przed uploadem. Darmowy Storage w Supabase to 1 GB,
 * a zdjęcie z aparatu telefonu potrafi ważyć 5 MB — przy 60 osobach i bingo
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
