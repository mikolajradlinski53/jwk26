import { track } from "@vercel/analytics";

/**
 * Anonimowe zdarzenia do Vercel Web Analytics (2026-10-11). Plan Pro
 * przyjmuje najwyżej 2 właściwości na zdarzenie. Nigdy treść pól, adres
 * e-mail ani identyfikator osoby - tylko nazwa kroku, pula, kod błędu.
 */
export function zdarzenie(nazwa: string, wlasciwosci?: Record<string, string>) {
  try {
    track(nazwa, wlasciwosci);
  } catch {
    // Statystyki nie mogą zepsuć zapisu ani logowania.
  }
}

/**
 * Kod błędu zgłoszenia bez treści: PULA_PELNA, FORMULARZ_NIEAKTUALNY itd.
 * Wszystko inne jako „inny” - surowy komunikat bazy potrafi zawierać dane.
 */
export function kodBledu(tekst: string): string {
  const kod = tekst.match(/[A-Z]{3,}(?:_[A-Z]+)+/);
  if (kod) return kod[0];
  if (/failed to fetch|network|load failed/i.test(tekst)) return "SIEC";
  if (/one_pending|duplicate key/i.test(tekst)) return "DUBEL";
  return "inny";
}
