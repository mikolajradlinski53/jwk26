import type { createClient } from "@/lib/supabase/server";

type Klient = Awaited<ReturnType<typeof createClient>>;

export type StanZgod = {
  maDaneZdrowotne: boolean;
  zgodaWizerunek: boolean;
  zgodaSms: boolean;
};

/**
 * Czy użytkownik ma coś, co może wycofać - dla sekcji „Twoje zgody".
 *
 * Dane zdrowotne sprawdzamy po wszystkich zgłoszeniach tej osoby, nie tylko
 * po przekazanym: `wycofaj_zgode_zdrowie` czyści je naraz we wszystkich, a
 * odrzucone zgłoszenie sprzed bieżącej próby wciąż może trzymać wiersz
 * w `dane_wrazliwe` (albo starą dietę w `diet_notes`).
 */
export async function stanZgod(
  supabase: Klient,
  userId: string,
  zgloszenie: { zgoda_wizerunek: boolean; sms_consent: boolean } | null,
): Promise<StanZgod> {
  // RLS wpuszcza tu wyłącznie własne zgłoszenia.
  const { data: zgloszenia, error: bladZgloszen } = await supabase
    .from("registrations")
    .select("id, diet_notes")
    .eq("user_id", userId);

  const lista = (zgloszenia ?? []) as { id: string; diet_notes: string | null }[];
  const idki = lista.map((z) => z.id);

  // Puste `.in()` samo w sobie nie jest błędem, ale nie ma po co pytać bazy
  // o wiersze dla listy identyfikatorów, której nie ma.
  const { data: wrazliwe, error: bladWrazliwych } =
    idki.length > 0
      ? await supabase
          .from("dane_wrazliwe")
          .select("dieta, alergie, choroby_leki")
          .in("registration_id", idki)
      : { data: [] as { dieta: string | null; alergie: string | null; choroby_leki: string | null }[], error: null };

  if (bladZgloszen) {
    console.error("Stan zgód: odczyt zgłoszeń nie przeszedł:", {
      code: bladZgloszen.code,
      message: bladZgloszen.message,
    });
  }
  if (bladWrazliwych) {
    console.error("Stan zgód: odczyt danych wrażliwych nie przeszedł:", {
      code: bladWrazliwych.code,
      message: bladWrazliwych.message,
    });
  }

  // Błąd odczytu traktujemy tak, jakby dane były - pokazanie przycisku
  // usunięcia jest w najgorszym razie nieszkodliwe (RPC sprząta tylko to, co
  // faktycznie istnieje), a ukrycie go, gdy dane naprawdę są, łamie
  // art. 7 ust. 3 RODO: wycofanie ma być równie łatwe jak wyrażenie zgody.
  const maDaneZdrowotne =
    bladZgloszen || bladWrazliwych
      ? true
      : lista.some((z) => !!z.diet_notes) ||
        (wrazliwe ?? []).some((w) => w.dieta || w.alergie || w.choroby_leki);

  return {
    maDaneZdrowotne,
    zgodaWizerunek: zgloszenie?.zgoda_wizerunek ?? false,
    zgodaSms: zgloszenie?.sms_consent ?? false,
  };
}
