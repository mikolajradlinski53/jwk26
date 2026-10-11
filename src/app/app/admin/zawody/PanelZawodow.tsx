"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikatZawodow, type DruzynaZawodow, type Mecz, type Zawody } from "@/lib/zawody";

function useAkcja() {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);
  async function wykonaj(zapytanie: () => PromiseLike<{ error: { message: string } | null }>) {
    if (wToku.current) return false;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await zapytanie();
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Akcja admina na zawodach nie przeszła:", error);
      setBlad(komunikatZawodow(error));
      return false;
    }
    router.refresh();
    return true;
  }
  return { blad, setBlad, czeka, wykonaj };
}

export function PanelZawodow({
  zawody: z,
  druzyny,
  zapisani,
  mecze,
}: {
  zawody: Zawody;
  druzyny: (DruzynaZawodow & { ludzie: string[] })[];
  zapisani: { id: string; nazwa: string }[];
  mecze: Mecz[];
}) {
  const { blad, czeka, wykonaj } = useAkcja();
  const [limit, setLimit] = useState(String(z.limit_miejsc ?? ""));
  const nazwaDruzyny = new Map(druzyny.map((d) => [d.id, d.nazwa]));
  const db = () => createClient();

  function przelaczZapisy() {
    const pytanie = z.zapisy_otwarte
      ? `Zamknąć zapisy na ${z.nazwa}? Uczestnicy nie zmienią już składów.`
      : `Otworzyć zapisy na ${z.nazwa}?`;
    if (!window.confirm(pytanie)) return;
    void wykonaj(() => db().from("zawody").update({ zapisy_otwarte: !z.zapisy_otwarte }).eq("id", z.id));
  }

  function zapiszLimit() {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 500) return;
    void wykonaj(() => db().from("zawody").update({ limit_miejsc: n }).eq("id", z.id));
  }

  function ulozMecze() {
    if (mecze.length > 0 && !window.confirm("Ułożyć terminarz od nowa? Obecne pary znikną.")) return;
    void wykonaj(() => db().rpc("uloz_mecze", { p_zawody: z.id }));
  }

  return (
    <section className="szklo grid grid-cols-[minmax(0,1fr)] gap-4 rounded-md px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-tytul text-xl text-kosc">{z.nazwa}</h2>
        <span className={`text-[0.6rem] font-bold uppercase tracking-[0.14em] ${z.zapisy_otwarte ? "text-krew-jasna" : "text-dym"}`}>
          {z.zapisy_otwarte ? "Zapisy trwają" : "Zapisy zamknięte"}
        </span>
      </div>
      <p className="text-xs text-dym">
        {z.druzynowe
          ? `Składy po ${z.rozmiar_skladu}${z.wymaga_dziewczyny ? ", z dziewczyną" : ""} · składów: ${druzyny.length}`
          : `Indywidualnie · zapisanych ${zapisani.length}${z.limit_miejsc ? ` z ${z.limit_miejsc}` : ""}`}
      </p>

      <Button variant={z.zapisy_otwarte ? "szklo" : "krew"} onClick={przelaczZapisy} disabled={czeka}>
        {z.zapisy_otwarte ? "Zamknij zapisy" : "Otwórz zapisy"}
      </Button>

      {!z.druzynowe && (
        <div className="grid gap-2">
          <Field label="Limit miejsc" type="number" inputMode="numeric" min={1} max={500} value={limit} onChange={(e) => setLimit(e.target.value)} />
          {limit !== String(z.limit_miejsc ?? "") && (
            <Button variant="szklo" onClick={zapiszLimit} disabled={czeka}>
              Zapisz limit
            </Button>
          )}
        </div>
      )}

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      {z.druzynowe && druzyny.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-kosc">Składy ({druzyny.length})</summary>
          <ul className="mt-2 grid gap-2">
            {druzyny.map((d) => (
              <li key={d.id} className="rounded-sm border border-kosc/10 px-3 py-2">
                <p className="flex items-baseline justify-between gap-2 text-sm text-kosc">
                  <span className="font-bold">{d.nazwa}</span>
                  <span className="text-xs text-dym">
                    {d.ludzie.length}/{z.rozmiar_skladu}
                    {d.ludzie.length < (z.rozmiar_skladu ?? 0) ? " · niepełny" : ""}
                  </span>
                </p>
                <p className="text-xs text-dym">{d.ludzie.join(", ")}</p>
                <Button
                  variant="cichy"
                  className="mt-1"
                  onClick={() => {
                    if (window.confirm(`Usunąć skład „${d.nazwa}” razem z jego meczami?`)) {
                      void wykonaj(() => db().from("zawody_druzyny").delete().eq("id", d.id));
                    }
                  }}
                  disabled={czeka}
                >
                  Usuń skład
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!z.druzynowe && zapisani.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-kosc">Zapisani ({zapisani.length})</summary>
          <ol className="mt-2 grid gap-1">
            {zapisani.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm text-kosc">
                <span>
                  {i + 1}. {s.nazwa}
                </span>
                <Button
                  variant="cichy"
                  onClick={() => {
                    if (window.confirm(`Wypisać ${s.nazwa}?`)) {
                      void wykonaj(() => db().from("zawody_zapisy").delete().eq("zawody_id", z.id).eq("user_id", s.id));
                    }
                  }}
                  disabled={czeka}
                >
                  Wypisz
                </Button>
              </li>
            ))}
          </ol>
        </details>
      )}

      {z.druzynowe && !z.zapisy_otwarte && druzyny.length >= 2 && (
        <Button variant="szklo" onClick={ulozMecze} disabled={czeka}>
          {mecze.length > 0 ? "Ułóż terminarz od nowa" : "Ułóż terminarz"}
        </Button>
      )}

      {mecze.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-bold text-kosc">Wyniki</p>
          {mecze.map((m) => (
            <WynikMeczu
              key={m.id}
              mecz={m}
              a={nazwaDruzyny.get(m.druzyna_a) ?? "?"}
              b={nazwaDruzyny.get(m.druzyna_b) ?? "?"}
              zapisz={(wa, wb) => wykonaj(() => db().from("zawody_mecze").update({ wynik_a: wa, wynik_b: wb }).eq("id", m.id))}
              czeka={czeka}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WynikMeczu({
  mecz,
  a,
  b,
  zapisz,
  czeka,
}: {
  mecz: Mecz;
  a: string;
  b: string;
  zapisz: (wa: number | null, wb: number | null) => Promise<boolean>;
  czeka: boolean;
}) {
  const [wa, setWa] = useState(mecz.wynik_a === null ? "" : String(mecz.wynik_a));
  const [wb, setWb] = useState(mecz.wynik_b === null ? "" : String(mecz.wynik_b));
  const pole =
    "szklo h-11 w-14 rounded-sm px-2 text-center text-sm tabular-nums text-kosc outline-none focus-visible:border-krew";
  const zmienione = wa !== (mecz.wynik_a === null ? "" : String(mecz.wynik_a)) || wb !== (mecz.wynik_b === null ? "" : String(mecz.wynik_b));

  function zapiszWynik() {
    if (wa === "" && wb === "") return void zapisz(null, null);
    const x = Number(wa);
    const y = Number(wb);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 999 || y > 999) return;
    void zapisz(x, y);
  }

  return (
    <div className="rounded-sm border border-kosc/10 px-3 py-2">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">Runda {mecz.runda}</p>
      <div className="mt-1 flex items-center gap-2 text-sm text-kosc">
        <span className="min-w-0 flex-1 truncate">{a}</span>
        <input aria-label={`Wynik: ${a}`} inputMode="numeric" value={wa} onChange={(e) => setWa(e.target.value.replace(/\D/g, ""))} className={pole} />
        <span>:</span>
        <input aria-label={`Wynik: ${b}`} inputMode="numeric" value={wb} onChange={(e) => setWb(e.target.value.replace(/\D/g, ""))} className={pole} />
        <span className="min-w-0 flex-1 truncate text-right">{b}</span>
      </div>
      {zmienione && (
        <Button variant="szklo" className="mt-2 w-full" onClick={zapiszWynik} disabled={czeka}>
          Zapisz wynik
        </Button>
      )}
    </div>
  );
}

/** Nowe zawody - na wypadek, gdyby do Topalek, siatkówki, pokera i szachów coś doszło. */
export function NoweZawody() {
  const { blad, setBlad, czeka, wykonaj } = useAkcja();
  const [nazwa, setNazwa] = useState("");
  const [druzynowe, setDruzynowe] = useState(true);
  const [ile, setIle] = useState("4");

  async function dodaj() {
    const n = Number(ile);
    if (!nazwa.trim()) return setBlad("Podaj nazwę.");
    if (!Number.isInteger(n) || n < (druzynowe ? 2 : 1) || n > (druzynowe ? 12 : 500)) {
      return setBlad(druzynowe ? "Skład liczy od 2 do 12 osób." : "Limit to od 1 do 500 miejsc.");
    }
    const ok = await wykonaj(() =>
      createClient()
        .from("zawody")
        .insert({
          nazwa: nazwa.trim(),
          druzynowe,
          rozmiar_skladu: druzynowe ? n : null,
          limit_miejsc: druzynowe ? null : n,
          kolejnosc: 100,
        }),
    );
    if (ok) setNazwa("");
  }

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <h2 className="text-sm font-bold">Dodaj zawody</h2>
      <Field label="Nazwa" value={nazwa} maxLength={40} onChange={(e) => setNazwa(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant={druzynowe ? "krew" : "szklo"} onClick={() => setDruzynowe(true)}>
          Drużynowe
        </Button>
        <Button variant={druzynowe ? "szklo" : "krew"} onClick={() => setDruzynowe(false)}>
          Indywidualne
        </Button>
      </div>
      <Field
        label={druzynowe ? "Osób w składzie" : "Limit miejsc"}
        type="number"
        inputMode="numeric"
        value={ile}
        onChange={(e) => setIle(e.target.value)}
      />
      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      <Button onClick={dodaj} disabled={czeka}>
        Dodaj (zapisy zamknięte)
      </Button>
    </section>
  );
}
