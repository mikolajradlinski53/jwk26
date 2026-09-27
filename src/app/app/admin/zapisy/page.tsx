import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Regulamin } from "./Regulamin";
import { Pula } from "./Pula";
import { Awans } from "./Awans";
import type { KluczPuli, StanPuli } from "@/types/db";

type WpisRezerwy = {
  id: string;
  pula: KluczPuli;
  imie: string | null;
  nazwisko: string | null;
  ksywka: string | null;
  proof_path: string | null;
};

export default async function ZapisyPage() {
  const supabase = await createClient();

  const [
    { data: pule, error },
    { data: rezerwa, error: bladRezerwy },
    { data: flaga, error: bladFlagi },
  ] = await Promise.all([
    supabase.rpc("stan_pul"),
    supabase
      .from("registrations")
      .select("id, pula, imie, nazwisko, ksywka, proof_path")
      .eq("status", "pending")
      .eq("rezerwa", true)
      .order("kolejnosc_rezerwy", { ascending: true }),
    supabase.from("app_settings").select("value").eq("key", "regulamin_zatwierdzony").maybeSingle(),
  ]);

  const wroc = (
    <Link
      href="/app/admin"
      className="mt-7 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
    >
      Wróć do sanktuarium
    </Link>
  );

  // Na ekranie admina błąd odczytu ma być widoczny — pusta lista pul
  // wyglądałaby jak „nie ma tur", a pusta rezerwa jak „nikt nie czeka",
  // choć oba są nieprawdą. Stąd sprawdzenie wszystkich trzech zapytań, nie
  // tylko pul.
  const bladOdczytu = error ?? bladRezerwy ?? bladFlagi;
  if (bladOdczytu) {
    console.error("Nie udało się wczytać danych zapisów:", bladOdczytu.code, bladOdczytu.message);
    return (
      <Ekran tytul="Zapisy">
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać danych. Odśwież stronę.
        </p>
        {wroc}
      </Ekran>
    );
  }

  const stan = (pule ?? []) as StanPuli[];
  const kolejka = (rezerwa ?? []) as WpisRezerwy[];
  const zatwierdzony = flaga?.value === true;

  return (
    <Ekran tytul="Zapisy" podtytul="Tury, miejsca i rezerwa">
      <Regulamin zatwierdzony={zatwierdzony} />

      <div className="mt-4 grid gap-4">
        {stan.map((p) => (
          // Klucz uwzględnia wartości z serwera, nie tylko p.klucz: karta ma
          // się zresetować, gdy zmieni je inny admin, ale nie przy każdym
          // odświeżeniu strony — inaczej niezapisana zmiana w tym oknie
          // zniknęłaby po cichu.
          <Pula
            key={`${p.klucz}:${p.otwarta}:${p.miejsca}:${zatwierdzony}`}
            pula={p}
            regulaminZatwierdzony={zatwierdzony}
          />
        ))}
      </div>

      <h2 className="mb-2.5 mt-8 px-1 text-xs uppercase tracking-[0.14em] text-dym">
        Lista rezerwowa
      </h2>
      {kolejka.length === 0 && (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">Pusto.</p>
      )}

      {stan.map((p) => {
        const wpisy = kolejka.filter((k) => k.pula === p.klucz);
        if (wpisy.length === 0) return null;
        const wolne = p.zajete < p.miejsca;
        return (
          <section key={p.klucz} className="mb-5">
            <h3 className="mb-1.5 px-1 text-sm font-bold">
              {p.nazwa}{" "}
              <span className="font-normal text-dym">
                {wolne ? `· wolnych miejsc: ${p.miejsca - p.zajete}` : "· brak wolnych miejsc"}
              </span>
            </h3>
            <ol className="grid gap-1.5">
              {wpisy.map((k, i) => (
                <li
                  key={k.id}
                  className="szklo flex items-center justify-between gap-3 rounded-md px-3.5 py-2.5"
                >
                  <span className="min-w-0 text-sm">
                    <span className="tabular-nums text-dym">{i + 1}.</span>{" "}
                    {k.imie} {k.nazwisko}
                    {k.ksywka && <span className="text-dym"> · {k.ksywka}</span>}
                    {k.proof_path && (
                      <span className="block text-xs text-dym">Ma już wgrany przelew</span>
                    )}
                  </span>
                  <Awans
                    id={k.id}
                    wolneMiejsce={wolne}
                    kto={`${k.imie ?? ""} ${k.nazwisko ?? ""}`.trim()}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {wroc}
    </Ekran>
  );
}
