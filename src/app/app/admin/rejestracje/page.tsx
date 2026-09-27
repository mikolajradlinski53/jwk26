import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { PrzyciskiDecyzji } from "./PrzyciskiDecyzji";
import { NAZWY_PUL, etykietaDojazdu } from "@/lib/zapisy/formularz";
import type { DaneWrazliwe, Registration, Team } from "@/types/db";

// Bez `export const dynamic`: klient serwerowy czyta cookies, co samo z siebie
// czyni trasę dynamiczną.
export default async function KolejkaRejestracji() {
  const supabase = await createClient();

  // Rezerwa ma własną kolejkę w /app/admin/zapisy — tu tylko osoby na miejscu.
  const [{ data: zgloszeniaRaw, error: zgloszeniaError }, { data: druzynyRaw }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("status", "pending")
      .eq("rezerwa", false)
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("*").order("name"),
  ]);

  const zgloszenia = (zgloszeniaRaw ?? []) as Registration[];
  const druzyny = (druzynyRaw ?? []) as Team[];

  // Podpisane URL-e żyją godzinę; równolegle, bo przy kilkudziesięciu
  // zgłoszeniach sekwencyjne podpisywanie widać gołym okiem.
  const [podpisy, { data: wrazliweRaw, error: wrazliweError }] = await Promise.all([
    Promise.all(
      zgloszenia.map(async (z) => {
        if (!z.proof_path) return [z.id, null] as const;
        const { data } = await supabase.storage
          .from("proofs")
          .createSignedUrl(z.proof_path, 3600);
        return [z.id, data?.signedUrl ?? null] as const;
      }),
    ),
    supabase
      .from("dane_wrazliwe")
      .select("*")
      .in(
        "registration_id",
        zgloszenia.map((z) => z.id),
      ),
  ]);
  const podglady = new Map(podpisy);
  const wrazliwe = new Map(
    ((wrazliweRaw ?? []) as DaneWrazliwe[]).map((w) => [w.registration_id, w]),
  );

  if (wrazliweError) {
    console.error("Nie udało się wczytać danych wrażliwych:", wrazliweError);
  }
  if (zgloszeniaError) {
    console.error("Nie udało się wczytać zgłoszeń:", zgloszeniaError.code, zgloszeniaError.message);
  }

  return (
    <Ekran tytul="Zgłoszenia">
      {wrazliweError && (
        <p className="szklo mb-5 rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać danych wrażliwych (ICE, zdrowie). Nie przyjmuj zgłoszeń, dopóki się
          nie wczytają — odśwież stronę.
        </p>
      )}
      {/* Błąd odczytu wygląda jak pusta kolejka, gdyby go tu nie rozróżnić —
          admin uznałby, że nie ma kogo rozpatrywać, choć zgłoszenia czekają. */}
      {zgloszeniaError ? (
        <p className="szklo rounded-md px-4 py-3.5 text-center text-sm text-krew-jasna">
          Nie udało się wczytać zgłoszeń. Odśwież stronę.
        </p>
      ) : (
        zgloszenia.length === 0 && <p className="text-center text-dym">Kolejka pusta.</p>
      )}

      <ul className="grid gap-8">
        {zgloszenia.map((z) => {
          const w = wrazliwe.get(z.id);
          const nazwa = z.imie && z.nazwisko ? `${z.imie} ${z.nazwisko}` : z.full_name;
          return (
            <li key={z.id} className="szklo overflow-hidden rounded-lg p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dym">
                {z.pula ? NAZWY_PUL[z.pula] : "Zgłoszenie sprzed tur"}
              </p>
              <p className="font-tytul tracking-wider text-kosc">{nazwa}</p>
              {z.ksywka && <p className="text-sm text-dym">Na identyfikatorze: {z.ksywka}</p>}

              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-dym">Telefon</dt>
                <dd className="text-kosc">{z.phone ?? "—"}</dd>
                {z.nr_indeksu && (
                  <>
                    <dt className="text-dym">Indeks</dt>
                    <dd className="text-kosc">{z.nr_indeksu}</dd>
                  </>
                )}
                {z.data_urodzenia && (
                  <>
                    <dt className="text-dym">Data ur.</dt>
                    <dd className="text-kosc">{z.data_urodzenia}</dd>
                  </>
                )}
                {z.dojazd && (
                  <>
                    <dt className="text-dym">Dojazd</dt>
                    <dd className="text-kosc">{etykietaDojazdu(z.dojazd)}</dd>
                  </>
                )}
                {z.piosenka && (
                  <>
                    <dt className="text-dym">Piosenka</dt>
                    <dd className="text-kosc">{z.piosenka}</dd>
                  </>
                )}
                {z.uwagi && (
                  <>
                    <dt className="text-dym">Uwagi</dt>
                    <dd className="text-kosc">{z.uwagi}</dd>
                  </>
                )}
              </dl>

              {/* Na wierzchu, bo tę informację musi zobaczyć każdy, kto
                  wybiera zdjęcia do publikacji (D9). */}
              {!z.zgoda_wizerunek && (
                <p className="mt-2 inline-block rounded-sm border border-krew/50 px-2 py-1 text-xs font-bold text-krew-jasna">
                  Bez zgody na wizerunek
                </p>
              )}

              {/* Dane z art. 9 pod przyciskiem, nie na wierzchu: kolejkę
                  przegląda się też na telefonie w miejscach publicznych. */}
              {(w || z.diet_notes) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-dym">
                    Dane wrażliwe (ICE, zdrowie)
                  </summary>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {w?.ice_telefon && (
                      <>
                        <dt className="text-dym">ICE</dt>
                        <dd className="text-kosc">
                          {w.ice_imie}, {w.ice_telefon}
                        </dd>
                      </>
                    )}
                    {w?.dieta && (
                      <>
                        <dt className="text-dym">Dieta</dt>
                        <dd className="text-kosc">{w.dieta}</dd>
                      </>
                    )}
                    {z.diet_notes && (
                      <>
                        <dt className="text-dym">Dieta (stare zgłoszenie)</dt>
                        <dd className="text-kosc">{z.diet_notes}</dd>
                      </>
                    )}
                    {w?.alergie && (
                      <>
                        <dt className="text-dym">Alergie</dt>
                        <dd className="text-kosc">{w.alergie}</dd>
                      </>
                    )}
                    {w?.choroby_leki && (
                      <>
                        <dt className="text-dym">Choroby, leki</dt>
                        <dd className="text-kosc">{w.choroby_leki}</dd>
                      </>
                    )}
                  </dl>
                </details>
              )}

              {!z.proof_path ? (
                <p className="mt-3 text-sm text-dym">
                  Awansowano z rezerwy. Czeka na potwierdzenie przelewu.
                </p>
              ) : podglady.get(z.id) ? (
                // Zwykły <img>: podpisany URL wygasa po godzinie, więc
                // optymalizator next/image nie miałby czego cache'ować.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={podglady.get(z.id)!}
                  alt={`Dowód przelewu — ${nazwa}`}
                  loading="lazy"
                  className="mt-3 w-full"
                />
              ) : (
                <p className="mt-3 text-sm text-krew-jasna">Nie udało się wczytać zdjęcia.</p>
              )}

              {z.proof_path && (
                <p className="mt-3 text-xs text-dym">
                  {z.ocr_confidence === null
                    ? "OCR się nie powiódł — oceniaj wyłącznie po zdjęciu."
                    : `OCR: ${z.ocr_keywords_hit} słów kluczowych, pewność ${Math.round(
                        z.ocr_confidence * 100,
                      )}%`}
                </p>
              )}
              {z.ocr_text && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-dym">Odczytany tekst</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-dym">
                    {z.ocr_text}
                  </pre>
                </details>
              )}

              <PrzyciskiDecyzji
                zgloszenieId={z.id}
                druzyny={druzyny}
                mozePrzyjac={z.proof_path !== null}
              />
            </li>
          );
        })}
      </ul>

      <Link
        href="/app/admin"
        className="mt-8 flex min-h-11 items-center px-4 font-tytul text-sm
                   uppercase tracking-widest text-dym hover:text-kosc"
      >
        ← Sanktuarium
      </Link>
    </Ekran>
  );
}
