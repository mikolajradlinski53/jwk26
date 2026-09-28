import type { createClient } from "@/lib/supabase/server";
import { kontoPoprawne, type DanePrzelewu } from "./qrPrzelewu";

type Klient = Awaited<ReturnType<typeof createClient>>;

export const KLUCZE_PRZELEWU = [
  "przelew_numer_konta",
  "przelew_odbiorca",
  "przelew_kwota",
] as const;

/**
 * Dane do przelewu z mapy ustawień albo `null`, gdy są niekompletne.
 * `null` jest odpowiedzią, nie błędem: przed podaniem numeru konta formularz
 * i landing mówią „dane pojawią się wkrótce", zamiast pokazywać kod QR
 * z pustym rachunkiem, który aplikacja banku odrzuci.
 */
export function danePrzelewuZUstawien(mapa: Map<string, unknown>): DanePrzelewu | null {
  const konto = String(mapa.get("przelew_numer_konta") ?? "");
  const odbiorca = String(mapa.get("przelew_odbiorca") ?? "").trim();
  const kwota = Number(mapa.get("przelew_kwota"));

  if (!kontoPoprawne(konto) || !odbiorca || !Number.isFinite(kwota) || kwota <= 0) {
    return null;
  }
  return { konto, odbiorca, kwota };
}

/** Odczyt dla stron serwerowych. Błąd odczytu degraduje do „wkrótce", jak brak danych. */
export async function wczytajDanePrzelewu(supabase: Klient): Promise<DanePrzelewu | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [...KLUCZE_PRZELEWU]);

  if (error) {
    console.error("Nie udało się wczytać danych do przelewu:", {
      code: error.code,
      message: error.message,
    });
    return null;
  }
  return danePrzelewuZUstawien(new Map((data ?? []).map((w) => [w.key as string, w.value])));
}
