"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";
import { NAZWY_PUL } from "@/lib/zapisy/formularz";
import type { KluczPuli } from "@/types/db";

type Adresat = "all" | "team" | "pula";

const ETYKIETA = "mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym";
const POLE =
  "szklo min-h-11 w-full rounded-sm px-3 text-sm text-kosc outline-none focus-visible:border-krew";

/**
 * Ogłoszenie push do wszystkich, drużyny albo puli. Wysłanego nie da się
 * cofnąć, więc przed wysyłką jest krok potwierdzenia z nazwą adresata.
 */
export function Ogloszenie({
  druzyny,
  zgodSms,
}: {
  druzyny: { id: string; name: string }[];
  /** Ilu przyjętych ma zgodę na SMS i numer - tylu (najwyżej) dostanie SMS. */
  zgodSms: number;
}) {
  const router = useRouter();
  const [sms, setSms] = useState(false);
  const [tytul, setTytul] = useState("");
  const [tresc, setTresc] = useState("");
  const [adresat, setAdresat] = useState<Adresat>("all");
  const [druzyna, setDruzyna] = useState(druzyny[0]?.id ?? "");
  const [pula, setPula] = useState<KluczPuli>("dzialacze");
  const [pyta, setPyta] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState(false);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  const komu =
    adresat === "all"
      ? "wszystkich przyjętych"
      : adresat === "team"
        ? `drużyny ${druzyny.find((d) => d.id === druzyna)?.name ?? ""}`
        : `puli ${NAZWY_PUL[pula]}`;

  function sprawdz() {
    setBlad(null);
    setUdane(false);
    if (!tytul.trim() || !tresc.trim()) {
      setBlad("Tytuł i treść są wymagane");
      return;
    }
    setPyta(true);
  }

  async function wyslij() {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);

    const { error } = await createClient().rpc("wyslij_ogloszenie", {
      p_tytul: tytul.trim(),
      p_tresc: tresc.trim(),
      p_adresat: adresat,
      p_druzyna: adresat === "team" ? druzyna : null,
      p_pula: adresat === "pula" ? pula : null,
      p_sms: sms,
    });

    setCzeka(false);
    wToku.current = false;
    setPyta(false);

    if (error) {
      console.error("Wysłanie ogłoszenia nie przeszło:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    setTytul("");
    setTresc("");
    setSms(false);
    setUdane(true);
    router.refresh();
  }

  return (
    <section className="grid gap-4">
      <Field
        label="Tytuł"
        maxLength={80}
        placeholder="Zbiórka"
        value={tytul}
        onChange={(e) => setTytul(e.target.value)}
      />
      <label className="block">
        <span className={ETYKIETA}>Treść</span>
        <textarea
          rows={3}
          maxLength={300}
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          placeholder="O 10:00 przy autokarze, z bagażem."
          className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none placeholder:text-dym focus-visible:border-krew"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={ETYKIETA}>Do kogo</span>
          <select value={adresat} onChange={(e) => setAdresat(e.target.value as Adresat)} className={POLE}>
            <option value="all">Wszyscy</option>
            <option value="team">Drużyna</option>
            <option value="pula">Pula</option>
          </select>
        </label>
        {adresat === "team" && (
          <label className="block">
            <span className={ETYKIETA}>Drużyna</span>
            <select value={druzyna} onChange={(e) => setDruzyna(e.target.value)} className={POLE}>
              {druzyny.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {adresat === "pula" && (
          <label className="block">
            <span className={ETYKIETA}>Pula</span>
            <select value={pula} onChange={(e) => setPula(e.target.value as KluczPuli)} className={POLE}>
              {(Object.keys(NAZWY_PUL) as KluczPuli[]).map((k) => (
                <option key={k} value={k}>
                  {NAZWY_PUL[k]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* SMS kosztuje - domyślnie wyłączony i gaśnie po każdej wysyłce. */}
      <label className="flex min-h-11 items-start gap-3 text-sm text-kosc">
        <input
          type="checkbox"
          checked={sms}
          onChange={(e) => setSms(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-krew)]"
        />
        <span>
          Wyślij też SMS-em
          <span className="block text-xs text-dym">
            Tylko do osób ze zgodą na SMS ({zgodSms} przyjętych). Płatne - na pilne sprawy.
          </span>
        </span>
      </label>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      {udane && (
        <p role="status" className="text-sm text-krew-jasna">
          Wysłano. Liczba urządzeń pojawi się w historii za chwilę.
        </p>
      )}

      {pyta ? (
        <div className="szklo grid gap-3 rounded-md px-4 py-3.5">
          <p aria-live="polite" className="text-sm text-kosc">
            Wysłać do {komu}{sms ? " - także SMS-em" : ""}? Tego nie da się cofnąć.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="szklo" onClick={() => setPyta(false)} disabled={czeka}>
              Zostaw
            </Button>
            <Button onClick={() => void wyslij()} disabled={czeka}>
              {czeka ? "Wysyłam…" : "Wyślij"}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={sprawdz}>Wyślij ogłoszenie</Button>
      )}
    </section>
  );
}
