import type { createClient } from "@/lib/supabase/server";

type Klient = Awaited<ReturnType<typeof createClient>>;

export type StanZgod = {
  maDaneZdrowotne: boolean;
  zgodaWizerunek: boolean;
  zgodaSms: boolean;
};

/** Czy użytkownik ma coś, co może wycofać — dla sekcji „Twoje zgody". */
export async function stanZgod(
  supabase: Klient,
  zgloszenie: {
    id: string;
    zgoda_wizerunek: boolean;
    sms_consent: boolean;
    /** Dieta ze zgłoszeń sprzed planu 08 — też dane o zdrowiu. */
    diet_notes: string | null;
  } | null,
): Promise<StanZgod> {
  if (!zgloszenie) return { maDaneZdrowotne: false, zgodaWizerunek: false, zgodaSms: false };

  // RLS wpuszcza tu wyłącznie właściciela i admina.
  const { data } = await supabase
    .from("dane_wrazliwe")
    .select("dieta, alergie, choroby_leki")
    .eq("registration_id", zgloszenie.id)
    .maybeSingle();

  return {
    maDaneZdrowotne:
      !!zgloszenie.diet_notes || !!(data && (data.dieta || data.alergie || data.choroby_leki)),
    zgodaWizerunek: zgloszenie.zgoda_wizerunek,
    // Kopia ze zgłoszenia; wycofaj_zgode_sms gasi ją razem z profilem.
    zgodaSms: zgloszenie.sms_consent,
  };
}
