/**
 * Licytacje (2026-10-22): wiersz `licytacje_lista()` i pomocniki ekranu.
 * Reguły ofert pilnuje baza (`licytuj`) - tu tylko podpowiedź kwoty
 * i tłumaczenie kodów błędów na zdania.
 */
export type LicytacjaWidok = {
  id: string;
  status: "trwa" | "zamknieta" | "anulowana";
  start: string;
  koniec: string;
  w_ciemno: boolean;
  cena_wywolawcza: number;
  najwyzsza: number | null;
  prowadzi_team: string | null;
  prowadzi_nazwa: string | null;
  prowadzi_kolor: string | null;
  liczba_ofert: number;
  /** NULL dla licytacji w ciemno do zamknięcia. */
  nazwa: string | null;
  opis: string | null;
  grafika: string | null;
  ikona: string | null;
  efekt: string | null;
  zwyciezca_team: string | null;
  zwyciezca_nazwa: string | null;
  cena_koncowa: number | null;
  order_id: string | null;
};

/** Najniższa kwota, którą baza przyjmie jako następną ofertę. */
export function minimalnaOferta(l: Pick<LicytacjaWidok, "najwyzsza" | "cena_wywolawcza">, krok: number): number {
  return l.najwyzsza === null ? l.cena_wywolawcza : l.najwyzsza + krok;
}

const KOMUNIKATY: Record<string, string> = {
  ZA_MALO: "Ktoś Was uprzedził albo kwota za mała. Odśwież.",
  JUZ_PROWADZICIE: "Prowadzicie - nie przebijacie samych siebie.",
  BRAK_PUNKTOW: "Za mało wolnych punktów (część trzymają Wasze prowadzące oferty).",
  LICYTACJA_NIEAKTYWNA: "Licytacja jest zamknięta albo jeszcze się nie zaczęła.",
  NIE_KAPITAN: "Licytuje kapitan drużyny.",
  ZLY_CEL: "Tej drużyny nie da się przekląć.",
  BRAK_UPRAWNIEN: "Klątwę rzuca kapitan drużyny, która ją wygrała.",
  ZAMOWIENIE_NIEAKTYWNE: "Ta klątwa została już rzucona.",
};

export function komunikatLicytacji(e: unknown): string {
  const tekst = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  const kod = Object.keys(KOMUNIKATY).find((k) => tekst.includes(k));
  return kod ? KOMUNIKATY[kod] : "Coś poszło nie tak. Spróbuj jeszcze raz.";
}

/** Publiczny adres grafiki przedmiotu z bucketu `przedmioty`. */
export function adresGrafiki(sciezka: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/przedmioty/${sciezka}`;
}
