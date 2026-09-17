/**
 * Zamienia błąd logowania na zdanie, z którym człowiek ma co zrobić.
 *
 * Najważniejszy przypadek to obca domena. Wyzwalacz `enforce_email_domain`
 * rzuca wyjątek w trakcie tworzenia konta, a GoTrue opakowuje to we własny,
 * ogólny komunikat — dlatego dopasowujemy oba warianty: naszą treść i tę,
 * którą podstawia Supabase.
 */
export function bladLogowania(surowy: string): string {
  if (/Dozwolone wy|Database error saving new user|unexpected_failure/i.test(surowy)) {
    return "Ten adres nie należy do Samorządu. Zaloguj się kontem @samorzad.ue.wroc.pl.";
  }
  if (/access_denied|cancelled|consent_required/i.test(surowy)) {
    return "Logowanie zostało przerwane.";
  }
  if (/expired|invalid.*(code|grant)/i.test(surowy)) {
    return "Ta próba logowania wygasła. Spróbuj jeszcze raz.";
  }
  return "Logowanie się nie udało. Spróbuj jeszcze raz.";
}
