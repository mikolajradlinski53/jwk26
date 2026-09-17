"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { Ustawienia } from "@/lib/ustawienia";

// Obie daty wydarzenia wypadają przed zmianą czasu 25 października 2026,
// więc stałe przesunięcie +02:00 (czas letni) jest dla nich poprawne.
const PRZESUNIECIE = "+02:00";

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
  return `${zSekundami}${PRZESUNIECIE}`;
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
      for (const [key, value] of Object.entries(zmiany)) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value })
          .eq("key", key);
        if (error) throw error;
      }
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
        error={blad}
      />

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
