/**
 * Zamienia błąd logowania na zdanie, z którym człowiek ma co zrobić.
 *
 * Wyzwalacz `enforce_email_domain` odrzuca już tylko konto bez adresu e-mail
 * (domeny nie sprawdza od 2026-10-07 - Świeżaki mają prywatne maile). GoTrue
 * opakowuje jego wyjątek we własny, ogólny komunikat - stąd oba warianty.
 */
/**
 * Rodzaj błędu bez treści - do statystyk i do decyzji, czy od razu pokazać
 * logowanie kodem z maila.
 */
export function kodBleduLogowania(surowy: string): string {
  if (/code verifier|code_verifier|flow.?state/i.test(surowy)) return "inne_okno";
  if (/wymaga adresu e-mail|Database error saving new user|unexpected_failure/i.test(surowy)) return "konto";
  if (/access_denied|cancelled|consent_required/i.test(surowy)) return "przerwane";
  if (/expired|invalid.*(code|grant)/i.test(surowy)) return "wygaslo";
  return "inny";
}

export function bladLogowania(surowy: string): string {
  // PKCE: logowanie zaczęło się w jednym „pojemniku” ciasteczek, a skończyło
  // w innym - na iPhonie apka z ekranu głównego i Safari mają osobne.
  if (/code verifier|code_verifier|flow.?state/i.test(surowy)) {
    return "Logowanie zaczęło się w innym oknie niż skończyło (np. w Safari zamiast w apce z ekranu). Zacznij jeszcze raz tutaj albo zaloguj się kodem z maila poniżej.";
  }
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
