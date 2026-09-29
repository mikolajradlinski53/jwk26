import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Regulamin } from "./Regulamin";
import { Pula } from "./Pula";
import { Awans } from "./Awans";
import { Odrzuc } from "./Odrzuc";
import type { KluczPuli, StanPuli } from "@/types/db";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { Pusto } from "@/components/Pusto";

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
    <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
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

      <NaglowekSekcji>Lista rezerwowa</NaglowekSekcji>
      {kolejka.length === 0 && (
        <Pusto>Pusto.</Pusto>
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
              {wpisy.map((k, i) => {
                const kto = `${k.imie ?? ""} ${k.nazwisko ?? ""}`.trim();
                return (
                  <li
                    key={k.id}
                    className="szklo flex flex-col gap-3 rounded-md px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="tabular-nums text-dym">{i + 1}.</span>{" "}
                      {k.imie} {k.nazwisko}
                      {k.ksywka && <span className="text-dym"> · {k.ksywka}</span>}
                      {k.proof_path && (
                        <span className="block text-xs text-dym">Ma już wgrany przelew</span>
                      )}
                    </span>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <Odrzuc id={k.id} kto={kto} />
                      <Awans id={k.id} wolneMiejsce={wolne} kto={kto} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {wroc}
    </Ekran>
  );
}
