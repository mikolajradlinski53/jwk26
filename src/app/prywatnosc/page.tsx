import Link from "next/link";
import { AKTUALIZACJA_POLITYKI, POLITYKA } from "@/lib/prywatnosc";

export const metadata = {
  title: "Polityka prywatności - JWK26",
  description: "Jak aplikacja JWK26 przetwarza dane osobowe.",
};

export const viewport = {
  themeColor: "#fbf3e7",
};

/**
 * Polityka prywatności. Publiczna jak regulamin i w tej samej jesiennej
 * oprawie - linkuje do niej landing, gdzie motyw sekty jest tajemnicą.
 */
export default function PrywatnoscPage() {
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-0 bg-jesien-tlo" />
      <main className="jesien relative z-10 mx-auto w-full max-w-2xl px-4 pb-16 pt-10">
        <Link href="/" className="text-sm text-jesien-rdza underline underline-offset-2">
          ← Wróć na start
        </Link>

        <h1 className="font-tytul mt-6 text-3xl leading-tight text-jesien-atrament">Polityka prywatności</h1>
        <p className="mt-1 text-xs text-jesien-kora">Ostatnia aktualizacja: {AKTUALIZACJA_POLITYKI}</p>

        <article className="mt-8 grid max-w-[65ch] gap-8 text-sm leading-relaxed text-jesien-kora">
          {POLITYKA.map((s, i) => (
            <section key={s.tytul}>
              <h2 className="font-tytul text-lg text-jesien-atrament">
                {i + 1}. {s.tytul}
              </h2>
              <div className="mt-2 grid gap-2">
                {s.bloki.map((b, j) =>
                  typeof b === "string" ? (
                    <p key={j}>{b}</p>
                  ) : (
                    <ul key={j} className="grid list-disc gap-2 pl-5 marker:text-jesien-kora/70">
                      {b.punkty.map((p, k) => (
                        <li key={k}>{p}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </article>

        <p className="mt-10 text-sm">
          <Link href="/regulamin" className="text-jesien-rdza underline underline-offset-2">
            Regulamin JWK26
          </Link>
        </p>
      </main>
    </>
  );
}
