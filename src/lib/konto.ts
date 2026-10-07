/** Domena kont Samorządu. Działacze i Alumni logują się wyłącznie nią. */
export const DOMENA_SAMORZADU = "@samorzad.ue.wroc.pl";

/**
 * Lustro `public.konto_samorzadowe()` z bazy - do podpowiedzi w interfejsie.
 * O tym, do której tury wolno się zapisać, i tak decyduje `zloz_zgloszenie`.
 * Od 2026-10-07 konto może mieć dowolny adres (Świeżaki - prywatne maile),
 * ale taki adres zapisuje się wyłącznie do tury Świeżaków.
 */
export function kontoSamorzadowe(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase().endsWith(DOMENA_SAMORZADU);
}

/** Jedyna tura dostępna z prywatnego maila. */
export const TURA_DLA_PRYWATNYCH = "swiezaki";
