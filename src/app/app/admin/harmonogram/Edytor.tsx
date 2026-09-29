"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";
import { krotkaGodzina, type PunktHarmonogramu } from "@/lib/harmonogram";

const PRZYCISK_MALY =
  "min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold text-kosc hover:bg-white/10 disabled:opacity-40";

/**
 * Formularz punktu — nowego albo istniejącego. Zapis idzie wprost do tabeli;
 * to, że pisze tylko admin, pilnuje RLS.
 */
export function FormularzPunktu({
  punkt,
  domyslnyDzien = "",
  onGotowe,
}: {
  punkt?: PunktHarmonogramu;
  domyslnyDzien?: string;
  onGotowe?: () => void;
}) {
  const router = useRouter();
  const [dzien, setDzien] = useState(punkt?.dzien ?? domyslnyDzien);
  const [godzina, setGodzina] = useState(krotkaGodzina(punkt?.godzina ?? null) ?? "");
  const [tytul, setTytul] = useState(punkt?.tytul ?? "");
  const [opis, setOpis] = useState(punkt?.opis ?? "");
  const [naLandingu, setNaLandingu] = useState(punkt?.na_landingu ?? false);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function zapisz() {
    if (wToku.current) return;
    setBlad(null);
    if (!dzien) {
      setBlad("Wybierz dzień");
      return;
    }
    if (!tytul.trim()) {
      setBlad("Podaj, co się dzieje");
      return;
    }

    wToku.current = true;
    setCzeka(true);
    const wiersz = {
      dzien,
      godzina: godzina || null,
      tytul: tytul.trim(),
      opis: opis.trim() || null,
      na_landingu: naLandingu,
    };
    const tabela = createClient().from("harmonogram");
    const { error } = punkt ? await tabela.update(wiersz).eq("id", punkt.id) : await tabela.insert(wiersz);
    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Zapis harmonogramu nie przeszedł:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    if (!punkt) {
      // Dzień zostaje — kolejne punkty zwykle dopisuje się do tego samego.
      setGodzina("");
      setTytul("");
      setOpis("");
      setNaLandingu(false);
    }
    onGotowe?.();
    router.refresh();
  }

  return (
    <div className={punkt ? "grid gap-4" : "szklo grid gap-4 rounded-md px-4 py-4"}>
      {!punkt && <h2 className="text-sm font-bold">Nowy punkt</h2>}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Dzień" type="date" value={dzien} onChange={(e) => setDzien(e.target.value)} />
        <Field label="Godzina" type="time" value={godzina} onChange={(e) => setGodzina(e.target.value)} />
      </div>
      <Field
        label="Co się dzieje"
        maxLength={80}
        placeholder="Zbiórka pod rektoratem"
        value={tytul}
        onChange={(e) => setTytul(e.target.value)}
      />
      <label className="block">
        <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
          Opis (opcjonalnie)
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          value={opis}
          onChange={(e) => setOpis(e.target.value)}
          placeholder="Miejsce, co zabrać, kto prowadzi…"
          className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none placeholder:text-dym focus-visible:border-krew"
        />
      </label>

      {/* Publiczne — landing pokazuje ten punkt każdemu, bez logowania. */}
      <label className="flex min-h-11 items-start gap-3 text-sm text-kosc">
        <input
          type="checkbox"
          checked={naLandingu}
          onChange={(e) => setNaLandingu(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-krew)]"
        />
        <span>
          Pokaż na landingu
          <span className="block text-xs text-dym">
            Publiczne — bez motywu wyjazdu i bez nazwy miejsca przed jego odsłoną.
          </span>
        </span>
      </label>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      {punkt ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="szklo" onClick={onGotowe} disabled={czeka}>
            Anuluj
          </Button>
          <Button onClick={() => void zapisz()} disabled={czeka}>
            {czeka ? "Zapisuję…" : "Zapisz"}
          </Button>
        </div>
      ) : (
        <Button onClick={() => void zapisz()} disabled={czeka}>
          {czeka ? "Dodaję…" : "Dodaj do harmonogramu"}
        </Button>
      )}
      {!punkt && (
        <p className="text-xs leading-relaxed text-dym">
          Bez godziny punkt ląduje na początku dnia — np. „cały dzień: gra terenowa”.
        </p>
      )}
    </div>
  );
}

/** Punkt na liście: podgląd, edycja w miejscu, usunięcie z potwierdzeniem. */
export function PunktDoEdycji({ punkt }: { punkt: PunktHarmonogramu }) {
  const router = useRouter();
  const [edycja, setEdycja] = useState(false);
  const [pyta, setPyta] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);

  async function usun() {
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().from("harmonogram").delete().eq("id", punkt.id);
    setCzeka(false);
    setPyta(false);
    if (error) {
      console.error("Usunięcie punktu nie przeszło:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  return (
    <li className="szklo rounded-md px-4 py-3.5">
      {edycja ? (
        <FormularzPunktu punkt={punkt} onGotowe={() => setEdycja(false)} />
      ) : (
        <>
          <div className="flex gap-4">
            <span className="w-12 flex-none pt-0.5 font-tytul text-lg leading-none tabular-nums text-krew-jasna">
              {krotkaGodzina(punkt.godzina) ?? "—"}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-kosc">{punkt.tytul}</h3>
              {punkt.na_landingu && (
                <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-krew-jasna">
                  Na landingu
                </p>
              )}
              {punkt.opis && (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-popiol">{punkt.opis}</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pyta ? (
              <>
                <span className="flex min-h-11 items-center text-xs text-kosc">Usunąć ten punkt?</span>
                <button type="button" onClick={() => setPyta(false)} disabled={czeka} className={PRZYCISK_MALY}>
                  Zostaw
                </button>
                <button type="button" onClick={() => void usun()} disabled={czeka} className={PRZYCISK_MALY}>
                  Usuń
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEdycja(true)} className={PRZYCISK_MALY}>
                  Edytuj
                </button>
                <button type="button" onClick={() => setPyta(true)} className={PRZYCISK_MALY}>
                  Usuń
                </button>
              </>
            )}
          </div>
          {blad && (
            <p role="alert" className="mt-2 text-sm text-krew-jasna">
              {blad}
            </p>
          )}
        </>
      )}
    </li>
  );
}
