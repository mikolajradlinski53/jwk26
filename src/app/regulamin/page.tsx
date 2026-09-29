import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OSWIADCZENIE_SZKODY, WERSJA_ZGOD } from "@/lib/zapisy/zgody";
import { REGULAMIN } from "@/lib/regulamin";

// `description` nadpisany osobno — bez tego strona dziedziczyłaby po
// `layout.tsx` opis napisany z myślą o mrocznej apce.
export const metadata = {
  title: "Regulamin — JWK26",
  description: "Zasady udziału w Jesiennym Wyjeździe Komisji 2026.",
};

export const viewport = {
  themeColor: "#fbf3e7",
};

/**
 * Regulamin wyjazdu. Trasa publiczna i osobna od landingu, żeby dało się ją
 * zlinkować wprost — z formularza zapisów albo komuś, kto pyta, na co się pisze.
 *
 * Baner „wersja robocza" zależy od `regulamin_zatwierdzony` w app_settings
 * (D8 speca zapisów). Anonim czyta tę flagę dzięki polityce settings_read_public.
 * Błąd odczytu zostawia baner: lepiej pokazać ostrzeżenie za dużo niż
 * udawać moc obowiązującą, której nie ma.
 */
export default async function RegulaminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "regulamin_zatwierdzony")
    .maybeSingle();
  const zatwierdzony = data?.value === true;

  return (
    <>
      {/* Jesienne tło pod całym oknem, nie tylko pod kolumną treści. Regulamin
          jest podpięty pod landing, a tam motyw sekty jest tajemnicą — wcześniej
          po bokach (komputer) i w wcięciu nad treścią (iPhone) prześwitywało
          ciemne tło apki. `fixed` przykrywa też to, co odsłania przewijanie
          poza krawędź. */}
      <div aria-hidden="true" className="fixed inset-0 z-0 bg-jesien-tlo" />
      <main className="jesien relative z-10 mx-auto w-full max-w-2xl px-4 pb-16 pt-10">
      <Link href="/" className="text-sm text-jesien-rdza underline underline-offset-2">
        ← Wróć na start
      </Link>

      <h1 className="font-tytul mt-6 text-3xl leading-tight text-jesien-atrament">
        Regulamin Jesiennego Wyjazdu Komisji 2026
      </h1>
      <p className="mt-1 text-xs text-jesien-kora">Wersja z {WERSJA_ZGOD}</p>

      {!zatwierdzony && (
        <div className="mt-5 rounded-md border border-jesien-dynia/50 bg-jesien-dynia/10 p-4 text-sm leading-relaxed text-jesien-atrament">
          <strong className="text-jesien-rdza">Wersja robocza.</strong> Ten
          dokument czeka na zatwierdzenie przez zarząd Samorządu Studenckiego
          i dziś nie ma mocy obowiązującej — traktuj go jako zapowiedź
          ostatecznych zasad, nie gotowy regulamin.
        </div>
      )}

      <article className="mt-8 grid max-w-[65ch] gap-8 text-sm leading-relaxed text-jesien-kora">
        {REGULAMIN.map((p) => (
          <section key={p.numer} id={`par-${p.numer}`}>
            <h2 className="font-tytul text-lg text-jesien-atrament">
              § {p.numer}. {p.tytul}
            </h2>
            <ol className="mt-2 grid list-decimal gap-2 pl-5 marker:text-jesien-kora/70">
              {p.ustepy.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ol>
            {p.numer === 13 && (
              <div className="mt-4 rounded-md border border-jesien-dynia/40 bg-jesien-dynia/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-jesien-rdza">
                  Oświadczenie akceptowane w formularzu zapisów
                </p>
                <p className="mt-2">{OSWIADCZENIE_SZKODY}</p>
              </div>
            )}
          </section>
        ))}
      </article>

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-jesien-rdza underline underline-offset-2"
      >
        ← Wróć na start
      </Link>
      </main>
    </>
  );
}
