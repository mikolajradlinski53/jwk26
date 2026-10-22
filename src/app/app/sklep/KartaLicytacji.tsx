"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { zdarzenie } from "@/lib/zdarzenia";
import { Button } from "@/components/ui/Button";
import { IkonaPozycji } from "@/components/IkonaPozycji";
import { adresGrafiki, komunikatLicytacji, minimalnaOferta, type LicytacjaWidok } from "@/lib/licytacje";
import type { Team } from "@/types/db";

/** Licznik „za 1 h 05 min” / „za 4:12”; null po czasie. */
function ileZostalo(doMs: number, teraz: number): string | null {
  const s = Math.floor((doMs - teraz) / 1000);
  if (s <= 0) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sek = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m}:${String(sek).padStart(2, "0")}`;
}

const GODZINA = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", hour: "2-digit", minute: "2-digit" });

export function KartaLicytacji({
  licytacja: l,
  krok,
  mojaDruzyna,
  jestKapitanem,
  klatwaDoRzucenia,
  druzynyNaKlatwe,
}: {
  licytacja: LicytacjaWidok;
  krok: number;
  mojaDruzyna: string | null;
  jestKapitanem: boolean;
  /** Wygrana Klątwa mojej drużyny czeka na wybór ofiary. */
  klatwaDoRzucenia: boolean;
  druzynyNaKlatwe: Team[];
}) {
  const router = useRouter();
  const [teraz, setTeraz] = useState(() => Date.now());
  const minimum = minimalnaOferta(l, krok);
  const [kwota, setKwota] = useState(String(minimum));
  const [cel, setCel] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setTeraz(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Po cudzym przebiciu (odświeżenie z realtime) podpowiedź idzie za nowym
  // minimum - dostosowanie stanu w trakcie renderu, bez efektu.
  const [poprzednieMinimum, setPoprzednieMinimum] = useState(minimum);
  if (poprzednieMinimum !== minimum) {
    setPoprzednieMinimum(minimum);
    setKwota(String(minimum));
  }

  const zamknieta = l.status === "zamknieta";
  const przedStartem = !zamknieta && Date.parse(l.start) > teraz;
  const doKonca = ileZostalo(Date.parse(l.koniec), teraz);
  const doStartu = ileZostalo(Date.parse(l.start), teraz);
  const tajemnicza = l.nazwa === null;
  const prowadzimy = l.prowadzi_team !== null && l.prowadzi_team === mojaDruzyna;
  const moznaLicytowac = jestKapitanem && !zamknieta && !przedStartem && doKonca !== null && !prowadzimy;

  async function akcja(nazwa: string, wywolanie: () => PromiseLike<{ error: unknown }>) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await wywolanie();
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${nazwa} nie przeszło:`, error);
      setBlad(komunikatLicytacji(error));
      return;
    }
    router.refresh();
  }

  function licytuj() {
    const k = Number.parseInt(kwota, 10);
    if (!Number.isFinite(k) || k < minimum) {
      setBlad(`Najmniej ${minimum} pkt.`);
      return;
    }
    void akcja("Oferta", async () => {
      const wynik = await createClient().rpc("licytuj", { p_licytacja: l.id, p_kwota: k });
      if (!wynik.error) zdarzenie("licytacja", { akcja: "oferta" });
      return wynik;
    });
  }

  function rzuc() {
    if (!cel) {
      setBlad("Wybierz drużynę.");
      return;
    }
    void akcja("Klątwa", () => createClient().rpc("rzuc_klatwe", { p_order: l.order_id, p_target: cel }));
  }

  return (
    <article className="szklo overflow-hidden rounded-lg">
      <div className="flex gap-4 p-4">
        <div className="grid size-20 flex-none place-items-center overflow-hidden rounded-md bg-noc-glab text-kosc">
          {l.grafika ? (
            // eslint-disable-next-line @next/next/no-img-element -- grafika z publicznego bucketu, bez optymalizacji
            <img src={adresGrafiki(l.grafika)} alt="" className="size-full object-cover" />
          ) : (
            <IkonaPozycji ikona={tajemnicza ? null : l.ikona} className="size-10" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-tytul text-lg leading-tight text-kosc">{l.nazwa ?? "Tajemnicza nagroda"}</h3>
          <p className="mt-1 text-sm leading-relaxed text-kosc/80">
            {tajemnicza ? "Co to jest - dowiecie się po zamknięciu licytacji." : l.opis}
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-3.5">
        {zamknieta ? (
          <p className="text-sm text-kosc">
            {l.zwyciezca_nazwa ? (
              <>
                Wygrywa <b>{l.zwyciezca_nazwa}</b> za <b className="tabular-nums">{l.cena_koncowa} pkt</b>
              </>
            ) : (
              "Bez zwycięzcy"
            )}
          </p>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.6rem] uppercase tracking-[0.14em] text-dym">
                {l.najwyzsza === null ? "Cena wywoławcza" : "Najwyższa oferta"}
              </p>
              <p className="font-tytul text-2xl leading-tight tabular-nums text-krew-jasna">
                {l.najwyzsza ?? l.cena_wywolawcza} pkt
              </p>
              {l.prowadzi_nazwa && (
                <p className="text-xs text-dym">
                  <span style={{ color: l.prowadzi_kolor ?? undefined }}>{l.prowadzi_nazwa}</span>
                  {prowadzimy && " - prowadzicie"} · ofert: {l.liczba_ofert}
                </p>
              )}
            </div>
            <p className="flex-none text-right text-xs tabular-nums text-dym">
              {przedStartem ? (
                <>
                  start za
                  <br />
                  <b className="text-sm text-kosc">{doStartu}</b>
                </>
              ) : doKonca ? (
                <>
                  koniec za
                  <br />
                  <b className="text-sm text-kosc">{doKonca}</b>
                </>
              ) : (
                "Zamykanie…"
              )}
              <br />
              {GODZINA.format(new Date(przedStartem ? l.start : l.koniec))}
            </p>
          </div>
        )}

        {moznaLicytowac && (
          <div className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor={`kwota-${l.id}`}>
              Twoja oferta
            </label>
            <input
              id={`kwota-${l.id}`}
              inputMode="numeric"
              value={kwota}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) setKwota(e.target.value);
                setBlad(null);
              }}
              className="szklo min-h-11 w-full flex-1 rounded-full px-4 text-sm tabular-nums text-kosc outline-none focus-visible:border-krew"
            />
            <Button onClick={licytuj} disabled={czeka} className="flex-none px-5">
              {czeka ? "…" : "Licytuj"}
            </Button>
          </div>
        )}

        {zamknieta && klatwaDoRzucenia && jestKapitanem && (
          <div className="mt-3 grid gap-2">
            <select
              value={cel}
              onChange={(e) => setCel(e.target.value)}
              className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none focus-visible:border-krew"
            >
              <option value="">Na kogo rzucić klątwę?</option>
              {druzynyNaKlatwe.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Button onClick={rzuc} disabled={czeka}>
              {czeka ? "Rzucam…" : "Rzuć klątwę"}
            </Button>
          </div>
        )}
        {zamknieta && klatwaDoRzucenia && !jestKapitanem && (
          <p className="mt-2 text-xs text-dym">Klątwa czeka - ofiarę wybiera Wasz kapitan.</p>
        )}

        {blad && (
          <p role="alert" className="mt-2 text-sm text-krew-jasna">
            {blad}
          </p>
        )}
      </div>
    </article>
  );
}
