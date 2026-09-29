import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Formularz } from "./Formularz";
import { FormularzPrzelewu } from "./FormularzPrzelewu";
import { FormularzOdslon } from "./FormularzOdslon";
import type { Ustawienia } from "@/lib/ustawienia";
import { Wroc } from "@/components/Wroc";

const WroccLink = (
  <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
);

export default async function UstawieniaPage() {
  // Nie korzysta z `ustawienia()` z @/lib/ustawienia: ten helper celowo
  // połyka błąd odczytu (dla landingu brak liczników to degradacja, nie
  // usterka). Tutaj, na ekranie admina, błąd odczytu musi być widoczny -
  // stąd osobne, jawne zapytanie.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "data_jwk",
      "data_swiezakow",
      "miejsce_nazwa",
      "miejsce_adres",
      "przelew_numer_konta",
      "przelew_odbiorca",
      "przelew_kwota",
      "odslona_osrodek",
      "odslona_cena",
      "odslona_zapisy",
      "odslona_plan",
      "social_instagram",
      "social_facebook",
    ]);

  if (error) {
    console.error("Nie udało się wczytać ustawień wydarzenia (admin):", error);
    return (
      <Ekran tytul="Ustawienia" podtytul="Daty, miejsce, odsłony i profile">
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

  const kwota = Number(mapa.get("przelew_kwota"));

  return (
    <Ekran tytul="Ustawienia" podtytul="Daty, miejsce, odsłony i profile">
      <Formularz poczatkowe={poczatkowe} />
      <FormularzPrzelewu
        poczatkowe={{
          konto: String(mapa.get("przelew_numer_konta") ?? ""),
          odbiorca: String(mapa.get("przelew_odbiorca") ?? ""),
          kwota: Number.isFinite(kwota) && kwota > 0 ? kwota : null,
        }}
      />
      <FormularzOdslon
        poczatkowe={{
          osrodek: mapa.get("odslona_osrodek") || null,
          cena: mapa.get("odslona_cena") || null,
          zapisy: mapa.get("odslona_zapisy") || null,
          plan: mapa.get("odslona_plan") || null,
          instagram: String(mapa.get("social_instagram") ?? ""),
          facebook: String(mapa.get("social_facebook") ?? ""),
        }}
      />
      {WroccLink}
    </Ekran>
  );
}
