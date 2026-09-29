/**
 * Numer w formacie SMSAPI: same cyfry z kierunkowym, bez plusa. Formularz
 * zapisów przyjmuje numer z plusem, spacjami albo bez kierunkowego - polski
 * dziewięciocyfrowy dostaje 48. Czego nie da się rozpoznać, zwraca null
 * (wysyłka go pomija, zamiast płacić za SMS w próżnię).
 */
export function numerSms(numer: string): string | null {
  let cyfry = numer.replace(/[^\d+]/g, "");
  if (cyfry.startsWith("+")) cyfry = cyfry.slice(1);
  else if (cyfry.startsWith("00")) cyfry = cyfry.slice(2);
  else if (/^\d{9}$/.test(cyfry)) cyfry = "48" + cyfry;
  if (cyfry.includes("+")) return null;
  return /^\d{10,15}$/.test(cyfry) ? cyfry : null;
}

/** Unikalne, poprawne numery w kolejności pierwszego wystąpienia. */
export function numeryDoWysylki(numery: string[]): string[] {
  return [...new Set(numery.map(numerSms).filter((n): n is string => n !== null))];
}

/**
 * Treść SMS-a. Prefiks mówi, od kogo to jest - nadawca w SMSAPI bywa ogólny,
 * dopóki nie zarejestruje się własnej nazwy.
 */
export function trescSms(tytul: string, tresc: string | null): string {
  const t = tytul.trim();
  const b = tresc?.trim();
  return b ? `JWK26: ${t} - ${b}` : `JWK26: ${t}`;
}
