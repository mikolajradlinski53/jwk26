import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Formularz } from "./Formularz";
import type { Ustawienia } from "@/lib/ustawienia";

const WroccLink = (
  <Link
    href="/app/admin"
    className="mt-7 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
  >
    Wróć do sanktuarium
  </Link>
);

export default async function UstawieniaPage() {
  // Nie korzysta z `ustawienia()` z @/lib/ustawienia: ten helper celowo
  // połyka błąd odczytu (dla landingu brak liczników to degradacja, nie
  // usterka). Tutaj, na ekranie admina, błąd odczytu musi być widoczny —
  // stąd osobne, jawne zapytanie.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["data_jwk", "data_swiezakow", "miejsce_nazwa", "miejsce_adres"]);

  if (error) {
    console.error("Nie udało się wczytać ustawień wydarzenia (admin):", error);
    return (
      <Ekran tytul="Ustawienia" podtytul="Daty i miejsce wydarzenia">
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać ustawień. Odśwież stronę albo spróbuj później.
        </p>
        {WroccLink}
      </Ekran>
    );
  }

  const mapa = new Map((data ?? []).map((w) => [w.key as string, w.value as string]));
  const poczatkowe: Ustawienia = {
    dataJwk: mapa.get("data_jwk") ?? null,
    dataSwiezakow: mapa.get("data_swiezakow") ?? null,
    miejsceNazwa: mapa.get("miejsce_nazwa") ?? null,
    miejsceAdres: mapa.get("miejsce_adres") ?? null,
  };

  return (
    <Ekran tytul="Ustawienia" podtytul="Daty i miejsce wydarzenia">
      <Formularz poczatkowe={poczatkowe} />
      {WroccLink}
    </Ekran>
  );
}
