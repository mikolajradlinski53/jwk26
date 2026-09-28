"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";

/** Nowa kategoria z 2–8 nominowanymi spośród przyjętych. Startuje otwarta. */
export function NowaKategoria({ uczestnicy }: { uczestnicy: { id: string; nazwa: string }[] }) {
  const router = useRouter();
  const [tytul, setTytul] = useState("");
  const [opis, setOpis] = useState("");
  const [wybrani, setWybrani] = useState<Set<string>>(new Set());
  const [szukaj, setSzukaj] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  const widoczni = uczestnicy.filter((u) => u.nazwa.toLowerCase().includes(szukaj.trim().toLowerCase()));

  function przelacz(id: string) {
    setWybrani((w) => {
      const n = new Set(w);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function utworz() {
    if (wToku.current) return;
    setBlad(null);
    if (!tytul.trim()) {
      setBlad("Podaj nazwę kategorii");
      return;
    }
    if (wybrani.size < 2 || wybrani.size > 8) {
      setBlad("Wybierz od 2 do 8 nominowanych");
      return;
    }

    wToku.current = true;
    setCzeka(true);
    const { error } = await createClient().rpc("utworz_kategorie", {
      p_tytul: tytul.trim(),
      p_opis: opis.trim() || null,
      p_nominowani: [...wybrani],
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
    setWybrani(new Set());
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

      <div className="grid gap-2">
        <Field
          label={`Nominowani (${wybrani.size} z 2–8)`}
          placeholder="Szukaj po nazwie w apce"
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
        />
        <div className="grid max-h-64 gap-0.5 overflow-y-auto">
          {widoczni.map((u) => (
            <label key={u.id} className="flex min-h-11 items-center gap-3 text-sm text-kosc">
              <input
                type="checkbox"
                checked={wybrani.has(u.id)}
                onChange={() => przelacz(u.id)}
                className="size-5 shrink-0 accent-[var(--color-krew)]"
              />
              <span>{u.nazwa}</span>
            </label>
          ))}
        </div>
      </div>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      <Button onClick={() => void utworz()} disabled={czeka}>
        {czeka ? "Tworzę…" : "Utwórz i otwórz głosowanie"}
      </Button>
    </section>
  );
}
