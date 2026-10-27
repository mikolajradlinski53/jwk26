import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Galeria } from "@/app/landing/Galeria";
import { ZDJECIA_JWK26 } from "@/app/landing/zdjeciaJwk26";

/**
 * Zaślepka apki po wyjeździe (2026-10-27, „wygaś wszystko”). Wszystkie ekrany
 * apki poza panelem admina przekierowują tutaj (`gate.ts`); strona główna
 * zostaje bez zmian. Zdjęcia widzi tylko przyjęty uczestnik - lecą
 * z prywatnego bucketu trasą feedu z sesją. Dawny ranking: historia gita.
 */
export default async function Podziekowanie() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("status, role").eq("id", user.id).maybeSingle()
    : { data: null };
  const uczestnik = profil?.status === "approved";
  const admin = profil?.role === "admin";

  return (
    <main className="mx-auto grid w-full max-w-md gap-8 px-5 pb-12 pt-[max(3.5rem,env(safe-area-inset-top))] min-[850px]:max-w-[1000px]">
      <header className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-krew-jasna">
          JWK 2026 · Karpacz · 23-25 października
        </p>
        <h1 className="mt-4 font-tytul text-4xl leading-[1.1] text-kosc min-[600px]:text-5xl">
          Dziękujemy za wspaniały wyjazd!
        </h1>
        <p className="mx-auto mt-4 max-w-[44ch] text-sm leading-relaxed text-dym">
          Wyjazd za nami, a apka przechodzi w stan spoczynku. Dziękujemy za energię, zaliczone pola bingo, nocne
          questy i każde zdjęcie w feedzie. Do zobaczenia na kolejnym JWK!
        </p>
      </header>

      <section className="mx-auto w-full max-w-md rounded-lg border border-dashed border-krew-jasna/40 px-5 py-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-krew-jasna">Ewaluacja</p>
        <p className="mt-2 font-tytul text-xl text-kosc">Formularz ewaluacyjny pojawi się tu lada dzień</p>
        <p className="mt-2 text-sm leading-relaxed text-dym">
          Zajrzyj tu za kilka dni - Twoja opinia pomoże nam zrobić następny wyjazd jeszcze lepiej.
        </p>
      </section>

      {uczestnik && (
        <section>
          <h2 className="mb-4 px-1 text-xs uppercase tracking-[0.14em] text-dym">Tak było na JWK 2026</h2>
          <Galeria zdjecia={ZDJECIA_JWK26} etykieta="Zdjęcia z JWK 2026" ciemna />
        </section>
      )}

      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-dym">
        {admin && (
          <Link href="/app/admin" className="underline underline-offset-2">
            Panel organizatora
          </Link>
        )}
        <Link href="/" className="underline underline-offset-2">
          Strona JWK
        </Link>
      </footer>
    </main>
  );
}
