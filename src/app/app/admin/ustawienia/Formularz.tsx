"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { Ustawienia } from "@/lib/ustawienia";

/**
 * Przesunięcie strefy warszawskiej **dla konkretnej chwili**.
 *
 * Wcześniej stała `+02:00` była doklejana do każdej wpisanej daty. Dla dwóch
 * dat tego wydarzenia to działa, bo obie wypadają przed zmianą czasu
 * 25 października 2026 — ale ten ekran istnieje po to, żeby właściciel mógł
 * wpisać dowolną datę. Data listopadowa zapisywała się wtedy z letnim
 * przesunięciem i cicho przesuwała godzinę o jedną, bez ostrzeżenia.
 */
function przesuniecieWarszawy(lokalna: string): string {
  // Przybliżenie chwili wystarczy: przesunięcie zmienia się raz na pół roku,
  // a błąd rzędu godziny nie przeskoczy granicy zmiany czasu inaczej niż
  // w samą noc przestawienia zegarków.
  const przyblizona = new Date(`${lokalna}Z`);
  const nazwa = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "longOffset",
  })
    .formatToParts(przyblizona)
    .find((cz) => cz.type === "timeZoneName")?.value;

  // "GMT+02:00" → "+02:00"; przy niespodziance zostaje czas zimowy, bo lepiej
  // pomylić się o godzinę w stronę wcześniejszą niż zapisać śmieci.
  const dopasowanie = nazwa?.match(/[+-]\d{2}:\d{2}$/);
  return dopasowanie ? dopasowanie[0] : "+01:00";
}

function naDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  // <input type="datetime-local"> nie przyjmuje wartości ze strefą —
  // obcinamy przesunięcie ("+02:00" na końcu) przy odczycie.
  return iso.replace(/[+-]\d{2}:\d{2}$/, "");
}

function naIso(lokalna: string): string {
  // Wartość z <input type="datetime-local"> to zwykle "YYYY-MM-DDTHH:mm",
  // rzadziej (gdy przeglądarka pokaże sekundy) "YYYY-MM-DDTHH:mm:ss" —
  // sekundy dokładamy tylko wtedy, gdy ich brakuje.
  const zSekundami = /T\d{2}:\d{2}:\d{2}$/.test(lokalna) ? lokalna : `${lokalna}:00`;
  return `${zSekundami}${przesuniecieWarszawy(zSekundami)}`;
}

export function Formularz({ poczatkowe }: { poczatkowe: Ustawienia }) {
  const router = useRouter();
  const [dataJwk, setDataJwk] = useState(naDatetimeLocal(poczatkowe.dataJwk));
  const [dataSwiezakow, setDataSwiezakow] = useState(naDatetimeLocal(poczatkowe.dataSwiezakow));
  const [miejsceNazwa, setMiejsceNazwa] = useState(poczatkowe.miejsceNazwa ?? "");
  const [miejsceAdres, setMiejsceAdres] = useState(poczatkowe.miejsceAdres ?? "");
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState(false);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function zapisz() {
    if (wToku.current) return;
    setBlad(null);
    setUdane(false);

    if (!dataJwk || !dataSwiezakow) {
      setBlad("Obie daty są wymagane");
      return;
    }
    if (!miejsceNazwa.trim() || !miejsceAdres.trim()) {
      setBlad("Nazwa i adres miejsca są wymagane");
      return;
    }

    wToku.current = true;
    setCzeka(true);

    const zmiany: Record<string, string> = {
      data_jwk: naIso(dataJwk),
      data_swiezakow: naIso(dataSwiezakow),
      miejsce_nazwa: miejsceNazwa.trim(),
      miejsce_adres: miejsceAdres.trim(),
    };

    try {
      const supabase = createClient();
      // Jedno zapytanie zamiast czterech osobnych. Pętla `update` zostawiała
      // bazę w stanie mieszanym, gdy trzecie żądanie padło: dwa klucze
      // zapisane, dwa nie, a formularz dalej pokazywał to, co człowiek wpisał.
      // Sprawdzone na żywej bazie — tak właśnie się kończyło.
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          Object.entries(zmiany).map(([key, value]) => ({ key, value })),
          { onConflict: "key" },
        );
      if (error) throw error;
      setUdane(true);
      router.refresh();
    } catch (e) {
      console.error("Zapis ustawień wydarzenia nie przeszedł:", e);
      setBlad(e instanceof Error ? e.message : "Zapis się nie udał");
    } finally {
      setCzeka(false);
      wToku.current = false;
    }
  }

  return (
    <div className="grid gap-4">
      <Field
        label="Data JWK"
        type="datetime-local"
        value={dataJwk}
        onChange={(e) => setDataJwk(e.target.value)}
      />
      <Field
        label="Data Świeżaków"
        type="datetime-local"
        value={dataSwiezakow}
        onChange={(e) => setDataSwiezakow(e.target.value)}
      />
      <Field
        label="Nazwa miejsca"
        placeholder="OW Zielone Wzgórze"
        value={miejsceNazwa}
        onChange={(e) => setMiejsceNazwa(e.target.value)}
      />
      <Field
        label="Adres miejsca"
        placeholder="Poznańska 5, 58-540 Karpacz"
        value={miejsceAdres}
        onChange={(e) => setMiejsceAdres(e.target.value)}
      />

      {/* Komunikat należy do całego formularza, nie do ostatniego pola.
          Wcześniej trafiał przez `error` do „Adresu miejsca" niezależnie od
          przyczyny — czytnik ekranu ogłaszał wtedy, że to pole jest błędne,
          choć błąd dotyczył dat albo zapisu do bazy. */}
      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      {udane && (
        <p role="status" className="text-sm text-krew-jasna">
          Zapisano
        </p>
      )}

      <Button onClick={zapisz} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Zapisz"}
      </Button>
    </div>
  );
}
