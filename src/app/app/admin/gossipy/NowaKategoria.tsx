"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";

/**
 * Nowa kategoria - sama nazwa i opis. Nominują uczestnicy; kategoria startuje
 * otwarta, a wszyscy dostają powiadomienie.
 */
export function NowaKategoria() {
  const router = useRouter();
  const [tytul, setTytul] = useState("");
  const [opis, setOpis] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function utworz() {
    if (wToku.current) return;
    setBlad(null);
    if (!tytul.trim()) {
      setBlad("Podaj nazwę kategorii");
      return;
    }

    wToku.current = true;
    setCzeka(true);
    const { error } = await createClient().rpc("utworz_kategorie", {
      p_tytul: tytul.trim(),
      p_opis: opis.trim() || null,
    });
    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Utworzenie kategorii nie przeszło:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    setTytul("");
    setOpis("");
    router.refresh();
  }

  return (
    <section className="szklo grid gap-4 rounded-md px-4 py-4">
      <h2 className="text-sm font-bold">Nowa kategoria</h2>
      <Field
        label="Nazwa"
        maxLength={80}
        placeholder="Król parkietu"
        value={tytul}
        onChange={(e) => setTytul(e.target.value)}
      />
      <Field
        label="Opis (opcjonalnie)"
        maxLength={300}
        placeholder="Kto rozkręca każdą imprezę?"
        value={opis}
        onChange={(e) => setOpis(e.target.value)}
      />

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      <Button onClick={() => void utworz()} disabled={czeka}>
        {czeka ? "Tworzę…" : "Utwórz i otwórz nominacje"}
      </Button>
      <p className="text-xs leading-relaxed text-dym">
        Uczestnicy dostaną powiadomienie i sami nominują - każdy jedną osobę, z uzasadnieniem.
      </p>
    </section>
  );
}
