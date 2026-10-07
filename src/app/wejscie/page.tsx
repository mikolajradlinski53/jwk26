import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ZamekInstalacji } from "@/components/ZamekInstalacji";
import { ustawienia } from "@/lib/ustawienia";
import { Logowanie } from "./Logowanie";
import { METADANE_APKI } from "@/lib/metadaneApki";

// Tu odbywa się instalacja na ekranie głównym - nazwa i manifest apki.
export const metadata = METADANE_APKI;

function dataWyjazdu(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
}

/**
 * Brama: godło, nazwa wyjazdu i jasna informacja, kto wchodzi i jakim kontem
 * (spec wyglądu, „Logowanie”). Wcześniej był tu tytuł i przycisk przyklejone
 * do góry, a pod nimi pusta czerń - bez słowa o domenie samorządu, choć tylko
 * takie konta przechodzą przez wyzwalacz w bazie.
 */
export default async function WejsciePage() {
  // Ta trasa leży poza bramką, więc sesję sprawdzamy tutaj: kto jest już
  // zalogowany, nie ma po co oglądać ekranu wejścia.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  // Gość czyta ustawienia jak landing; awaria odczytu - wiersz bez daty.
  const data = dataWyjazdu((await ustawienia()).dataJwk);

  return (
    // Bez zamka instalacji: o 12:00 liczy się szybkość zapisu (ZamekKlient).
    <ZamekInstalacji zwolnione>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 py-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public, bez optymalizacji */}
          <img
            src="/grafika/godlo.webp"
            alt=""
            width={184}
            height={184}
            className="size-[184px] drop-shadow-[0_0_30px_rgb(200_16_46/0.25)]"
          />
          <h1 className="mt-1.5 font-tytul text-[2.1rem] leading-tight tracking-tight text-kosc">
            Wstąp do Sekty
          </h1>
          <p className="text-xs uppercase tracking-[0.14em] text-dym">
            Jesienny Wyjazd Komisji{data && <> · {data}</>}
          </p>
          <p className="szklo mt-2.5 rounded-md px-4 py-3.5 text-sm leading-relaxed text-kosc/85">
            Działacze i Alumni - kontem{" "}
            <strong className="text-kosc">@samorzad.ue.wroc.pl</strong>. Świeżaki - dowolnym
            adresem e-mail.
          </p>
          <div className="mt-1.5 w-full">
            {/* Logowanie czyta błąd z adresu przez useSearchParams, a to wymaga
                granicy Suspense - bez niej build wywala całą trasę. */}
            <Suspense fallback={null}>
              <Logowanie />
            </Suspense>
          </div>
        </div>
        <footer className="flex justify-center pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-xs text-dym">
          <Link href="/regulamin" className="flex min-h-11 items-center px-2 hover:text-kosc">
            Regulamin
          </Link>
        </footer>
      </main>
    </ZamekInstalacji>
  );
}
