/**
 * Zamienia błąd logowania na zdanie, z którym człowiek ma co zrobić.
 *
 * Wyzwalacz `enforce_email_domain` odrzuca już tylko konto bez adresu e-mail
 * (domeny nie sprawdza od 2026-10-07 - Świeżaki mają prywatne maile). GoTrue
 * opakowuje jego wyjątek we własny, ogólny komunikat - stąd oba warianty.
 */
export function bladLogowania(surowy: string): string {
  if (/wymaga adresu e-mail|Database error saving new user|unexpected_failure/i.test(surowy)) {
    return "Tego konta nie da się użyć - zaloguj się kontem z adresem e-mail.";
  }
  if (/access_denied|cancelled|consent_required/i.test(surowy)) {
    return "Logowanie zostało przerwane.";
  }
  if (/expired|invalid.*(code|grant)/i.test(surowy)) {
    return "Ta próba logowania wygasła. Spróbuj jeszcze raz.";
  }
  return "Logowanie się nie udało. Spróbuj jeszcze raz.";
}
