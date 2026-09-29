"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { naDatetimeLocal, naIso } from "./Formularz";

export type PoczatkoweOdslony = {
  osrodek: string | null;
  cena: string | null;
  zapisy: string | null;
  instagram: string;
  facebook: string;
};

/**
 * Daty odsłon landingu i adresy profili. Pusta data = sekcja odsłonięta od
 * razu; odsłona zapisów odsłania wszystko. Adres profilu musi być adresem
 * w swoim serwisie (pilnuje tego też baza).
 */
export function FormularzOdslon({ poczatkowe }: { poczatkowe: PoczatkoweOdslony }) {
  const router = useRouter();
  const [osrodek, setOsrodek] = useState(naDatetimeLocal(poczatkowe.osrodek));
  const [cena, setCena] = useState(naDatetimeLocal(poczatkowe.cena));
  const [zapisy, setZapisy] = useState(naDatetimeLocal(poczatkowe.zapisy));
  const [instagram, setInstagram] = useState(poczatkowe.instagram);
  const [facebook, setFacebook] = useState(poczatkowe.facebook);
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState(false);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function zapisz() {
    if (wToku.current) return;
    setBlad(null);
    setUdane(false);
    if (instagram.trim() && !instagram.trim().startsWith("https://www.instagram.com/")) {
      setBlad("Adres Instagrama musi zaczynać się od https://www.instagram.com/");
      return;
    }
    if (facebook.trim() && !facebook.trim().startsWith("https://www.facebook.com/")) {
      setBlad("Adres Facebooka musi zaczynać się od https://www.facebook.com/");
      return;
    }

    wToku.current = true;
    setCzeka(true);
    const zmiany: Record<string, string> = {
      odslona_osrodek: osrodek ? naIso(osrodek) : "",
      odslona_cena: cena ? naIso(cena) : "",
      odslona_zapisy: zapisy ? naIso(zapisy) : "",
      social_instagram: instagram.trim(),
      social_facebook: facebook.trim(),
    };
    // Jedno zapytanie — pętla zostawiałaby bazę w stanie mieszanym przy awarii.
    const { error } = await createClient()
      .from("app_settings")
      .upsert(
        Object.entries(zmiany).map(([key, value]) => ({ key, value })),
        { onConflict: "key" },
      );
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Zapis odsłon nie przeszedł:", { code: error.code, message: error.message });
      setBlad("Zapis się nie udał. Sprawdź adresy profili i spróbuj jeszcze raz.");
      return;
    }
    setUdane(true);
    router.refresh();
  }

  return (
    <section className="mt-8 grid gap-4">
      <h2 className="text-sm font-bold">Odsłony na landingu</h2>
      <p className="text-xs leading-relaxed text-dym">
        Do tych chwil landing pokazuje zasłonę z licznikiem. Otwarcie zapisów odsłania też ośrodek i cenę.
        Puste pole = odsłonięte od razu.
      </p>
      <Field label="Ośrodek i miasto" type="datetime-local" value={osrodek} onChange={(e) => setOsrodek(e.target.value)} />
      <Field label="Cena i dane do przelewu" type="datetime-local" value={cena} onChange={(e) => setCena(e.target.value)} />
      <Field label="Zapisy" type="datetime-local" value={zapisy} onChange={(e) => setZapisy(e.target.value)} />

      <h2 className="mt-4 text-sm font-bold">Profile w stopce</h2>
      <Field
        label="Instagram"
        placeholder="https://www.instagram.com/…"
        value={instagram}
        onChange={(e) => setInstagram(e.target.value)}
      />
      <Field
        label="Facebook"
        placeholder="https://www.facebook.com/…"
        value={facebook}
        onChange={(e) => setFacebook(e.target.value)}
      />

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
      <Button onClick={() => void zapisz()} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Zapisz odsłony i profile"}
      </Button>
    </section>
  );
}
