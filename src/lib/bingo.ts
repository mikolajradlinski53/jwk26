/**
 * Środek planszy to pole darmowe: zaliczone od startu dla każdej drużyny,
 * bez zgłoszeń i bez punktów za samo pole, ale liczy się do linii i pełnej
 * planszy. To samo `12` siedzi w review_bingo i w strażniku zgłoszeń w bazie.
 */
export const POLE_DARMOWE = 12;

/**
 * Rozmiar tytułu w polu planszy z najdłuższego wyrazu: ok. 10 znaków mieści
 * się w linii przy 0,6 rem, dłuższe wyrazy dostają mniejszą czcionkę, zamiast
 * łamać się w środku („Odtworzeni-e”). Łamanie gdziekolwiek zostaje tylko dla
 * wyrazów, które nie zmieszczą się nawet najmniejszą czcionką.
 */
export function klasaTytuluPola(tytul: string): string {
  const najdluzszy = Math.max(0, ...tytul.split(/\s+/).map((w) => w.length));
  if (najdluzszy <= 9) return "text-[0.6rem]";
  if (najdluzszy <= 11) return "text-[0.53rem]";
  if (najdluzszy <= 13) return "text-[0.47rem]";
  return "text-[0.47rem] [overflow-wrap:anywhere]";
}
