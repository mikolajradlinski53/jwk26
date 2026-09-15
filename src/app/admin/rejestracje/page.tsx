import { createClient } from "@/lib/supabase/server";
import { RitualFrame } from "@/components/RitualFrame";
import { PrzyciskiDecyzji } from "./PrzyciskiDecyzji";
import type { Registration, Team } from "@/types/db";

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną. W Next 16 ta opcja i tak znika przy Cache Components.
export default async function KolejkaRejestracji() {
  const supabase = await createClient();

  const [{ data: zgloszeniaRaw }, { data: druzynyRaw }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("*").order("name"),
  ]);

  const zgloszenia = (zgloszeniaRaw ?? []) as Registration[];
  const druzyny = (druzynyRaw ?? []) as Team[];

  // Podpisane URL-e powstają przy renderze i żyją godzinę. Bucket jest prywatny,
  // więc bez nich obrazek nie ma jak się załadować. Równolegle, bo przy
  // kilkudziesięciu zgłoszeniach sekwencyjne podpisywanie widać gołym okiem.
  const wpisy = await Promise.all(
    zgloszenia.map(async (z) => {
      const { data } = await supabase.storage
        .from("proofs")
        .createSignedUrl(z.proof_path, 3600);
      return [z.id, data?.signedUrl ?? null] as const;
    }),
  );
  const podglady = new Map(wpisy);

  return (
    <RitualFrame title="Zgłoszenia">
      {zgloszenia.length === 0 && (
        <p className="text-center text-smoke">Kolejka pusta.</p>
      )}

      <ul className="grid gap-8">
        {zgloszenia.map((z) => (
          <li key={z.id} className="border border-candle/20 bg-ash/40 p-4">
            <p className="font-display tracking-wider text-candle">{z.full_name}</p>
            <p className="text-sm text-smoke">{z.phone ?? "bez telefonu"}</p>
            {z.diet_notes && (
              <p className="mt-2 text-sm text-parchment">Dieta: {z.diet_notes}</p>
            )}

            {/* Zwykły <img>, nie next/image: podpisany URL wygasa po godzinie,
                więc optymalizator i tak nie miałby czego cache'ować. */}
            {podglady.get(z.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={podglady.get(z.id)!}
                alt={`Dowód przelewu — ${z.full_name}`}
                // Bez lazy przeglądarka zleca pobranie wszystkich zdjęć w kolejce
                // naraz. Admin ogląda je po kolei, często na telefonie w drodze.
                loading="lazy"
                className="mt-3 w-full border border-candle/20"
              />
            ) : (
              <p className="mt-3 text-sm text-blood">Nie udało się wczytać zdjęcia.</p>
            )}

            <p className="mt-3 text-xs text-smoke">
              {z.ocr_confidence === null
                ? "OCR się nie powiódł — oceniaj wyłącznie po zdjęciu."
                : `OCR: ${z.ocr_keywords_hit} słów kluczowych, pewność ${Math.round(
                    z.ocr_confidence * 100,
                  )}%`}
            </p>
            {z.ocr_text && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-smoke">
                  Odczytany tekst
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-smoke">
                  {z.ocr_text}
                </pre>
              </details>
            )}

            <PrzyciskiDecyzji zgloszenieId={z.id} druzyny={druzyny} />
          </li>
        ))}
      </ul>
    </RitualFrame>
  );
}
