import { createClient } from "@/lib/supabase/server";

export type Ustawienia = {
  dataJwk: string | null;
  dataSwiezakow: string | null;
  miejsceNazwa: string | null;
  miejsceAdres: string | null;
};

/**
 * Czyta ustawienia wydarzenia. Awaria odczytu nie wywraca landinga — strona
 * bez liczników to degradacja, nie błąd, bo liczniki nie są powodem jej
 * istnienia. Ten sam odczyt na ekranie admina traktuje błąd inaczej.
 */
export async function ustawienia(): Promise<Ustawienia> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["data_jwk", "data_swiezakow", "miejsce_nazwa", "miejsce_adres"]);

  if (error) {
    console.error("Nie udało się wczytać ustawień wydarzenia:", error);
  }

  // Kolumna `value` jest typu jsonb, ale każdy z tych czterech kluczy trzyma
  // zwykły łańcuch znaków ('"..."'::jsonb) — PostgREST rozpakowuje to do
  // gołego JS-owego stringa, nie do obiektu. Zweryfikowane realnym odczytem
  // (klucz serwisowy projektu testowego), nie założeniem.
  const mapa = new Map((data ?? []).map((w) => [w.key as string, w.value as string]));
  return {
    dataJwk: mapa.get("data_jwk") ?? null,
    dataSwiezakow: mapa.get("data_swiezakow") ?? null,
    miejsceNazwa: mapa.get("miejsce_nazwa") ?? null,
    miejsceAdres: mapa.get("miejsce_adres") ?? null,
  };
}
