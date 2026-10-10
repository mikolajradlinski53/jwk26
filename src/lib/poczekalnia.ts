/**
 * Czy przyjęty uczestnik ma jeszcze czekać przed zamkniętą platformą.
 *
 * `otwarcie_platformy` ustawia admin; pusta albo nieczytelna wartość znaczy
 * „otwarte” - lepiej wpuścić za wcześnie niż zamknąć wszystkich przez literówkę.
 * Admini wchodzą zawsze: muszą przygotować platformę przed otwarciem.
 */
export function czekaNaOtwarcie(opcje: {
  rola: string | null | undefined;
  status: string | null | undefined;
  otwarcie: unknown;
  teraz: Date;
}): boolean {
  if (opcje.rola === "admin" || opcje.status !== "approved") return false;
  if (typeof opcje.otwarcie !== "string" || !opcje.otwarcie) return false;
  const cel = new Date(opcje.otwarcie).getTime();
  if (Number.isNaN(cel)) return false;
  return cel > opcje.teraz.getTime();
}
