"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikatZawodow } from "@/lib/zawody";
import { zdarzenie } from "@/lib/zdarzenia";

type Osoba = { id: string; nazwa: string };

/** „1 osobę”, „3 osoby”, „5 osób” - do składu liczy się do 11. */
function osoby(n: number): string {
  if (n === 1) return "osobę";
  return n >= 2 && n <= 4 ? "osoby" : "osób";
}

/** Wspólny rygiel i obsługa błędu dla akcji na zawodach. */
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
      console.error("Akcja na zawodach nie przeszła:", error);
      setBlad(komunikatZawodow(error));
      router.refresh();
      return false;
    }
    router.refresh();
    return true;
  }
  return { blad, setBlad, czeka, wykonaj };
}

function Blad({ tresc }: { tresc: string | null }) {
  if (!tresc) return null;
  return (
    <p role="alert" className="text-sm text-krew-jasna">
      {tresc}
    </p>
  );
}

/** Wybór osób z listy przyjętych: szukajka + pola wyboru, zajęci wyszarzeni. */
function WyborOsob({
  gracze,
  wybrani,
  ile,
  onZmiana,
}: {
  gracze: (Osoba & { sklad?: string | null })[];
  wybrani: string[];
  ile: number;
  onZmiana: (w: string[]) => void;
}) {
  const [szukaj, setSzukaj] = useState("");
  const widoczni = useMemo(() => {
    const s = szukaj.trim().toLowerCase();
    // Stała kolejność (alfabetycznie z bazy): przestawianie zaznaczonych na
    // górę przesuwało listę pod palcem i kolejne stuknięcie trafiało obok.
    return gracze.filter((g) => !s || g.nazwa.toLowerCase().includes(s));
  }, [gracze, szukaj]);

  return (
    <div className="grid gap-2">
      <Field label="Szukaj po ksywce" value={szukaj} onChange={(e) => setSzukaj(e.target.value)} />
      <p className="text-xs text-dym">
        Wybrano {wybrani.length} z {ile}
        {wybrani.length > 0 &&
          `: ${gracze
            .filter((g) => wybrani.includes(g.id))
            .map((g) => g.nazwa)
            .join(", ")}`}
      </p>
      <div className="szklo max-h-72 overflow-y-auto rounded-md px-3 py-1">
        {widoczni.length === 0 && <p className="py-3 text-sm text-dym">Nikogo takiego.</p>}
        {widoczni.map((g) => {
          const zaznaczony = wybrani.includes(g.id);
          const zablokowany = Boolean(g.sklad) || (!zaznaczony && wybrani.length >= ile);
          return (
            <label
              key={g.id}
              className={`flex min-h-11 items-center gap-3 text-sm ${g.sklad ? "text-dym" : "text-kosc"}`}
            >
              <input
                type="checkbox"
                checked={zaznaczony}
                disabled={zablokowany}
                onChange={(e) =>
                  onZmiana(e.target.checked ? [...wybrani, g.id] : wybrani.filter((x) => x !== g.id))
                }
                className="size-5 shrink-0 accent-[var(--color-krew)]"
              />
              <span className="min-w-0 flex-1 truncate">{g.nazwa}</span>
              {g.sklad && <span className="shrink-0 text-xs">w składzie „{g.sklad}”</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ZapisSkladu({
  zawodyId,
  rozmiar,
  wymagaDziewczyny,
  gracze,
}: {
  zawodyId: string;
  rozmiar: number;
  wymagaDziewczyny: boolean;
  gracze: (Osoba & { sklad: string | null })[];
}) {
  const { blad, setBlad, czeka, wykonaj } = useAkcja();
  const [nazwa, setNazwa] = useState("");
  const [wybrani, setWybrani] = useState<string[]>([]);
  const [dziewczyna, setDziewczyna] = useState(false);
  const ile = rozmiar - 1;

  function zapisz() {
    if (!nazwa.trim()) return setBlad("Nadaj składowi nazwę.");
    if (wybrani.length !== ile) {
      return setBlad(`Wybierz ${ile} ${osoby(ile)} - razem z Tobą skład liczy ${rozmiar} osób.`);
    }
    if (wymagaDziewczyny && !dziewczyna) return setBlad("Potwierdź, że w składzie jest dziewczyna.");
    void wykonaj(() =>
      createClient().rpc("zapisz_druzyne", {
        p_zawody: zawodyId,
        p_nazwa: nazwa.trim(),
        p_czlonkowie: wybrani,
        p_dziewczyna: dziewczyna,
      }),
    ).then((ok) => ok && zdarzenie("zawody", { akcja: "sklad" }));
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-bold">Zapisz skład</h2>
      <p className="text-xs leading-relaxed text-dym">
        Wpisujesz siebie i {ile} {osoby(ile)}. Każda dostanie powiadomienie i może się wypisać, póki trwają zapisy.
      </p>
      <Field label="Nazwa składu" value={nazwa} maxLength={40} onChange={(e) => setNazwa(e.target.value)} />
      <WyborOsob gracze={gracze} wybrani={wybrani} ile={ile} onZmiana={setWybrani} />
      {wymagaDziewczyny && (
        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-kosc">
          <input
            type="checkbox"
            checked={dziewczyna}
            onChange={(e) => setDziewczyna(e.target.checked)}
            className="mt-0.5 size-6 shrink-0 accent-[var(--color-krew)]"
          />
          <span>
            Przysięgam na brodę Organizatora, że w składzie jest co najmniej jedna dziewczyna. Bez niej
            Toplakyyy się nie liczą, a Sekta wszystko widzi.
          </span>
        </label>
      )}
      <Blad tresc={blad} />
      <Button onClick={zapisz} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Zapisz skład"}
      </Button>
    </section>
  );
}

export function MojSklad({
  zawodyId,
  druzyna,
  czlonkowie,
  rozmiar,
  jestemZalozycielem,
  zapisyOtwarte,
  wolni,
}: {
  zawodyId: string;
  druzyna: { id: string; nazwa: string };
  czlonkowie: Osoba[];
  rozmiar: number;
  jestemZalozycielem: boolean;
  zapisyOtwarte: boolean;
  wolni: Osoba[];
}) {
  const { blad, czeka, wykonaj } = useAkcja();
  const [nowi, setNowi] = useState<string[]>([]);
  const brakuje = rozmiar - czlonkowie.length;

  function wypisz() {
    const pytanie = jestemZalozycielem
      ? `Rozwiązać skład „${druzyna.nazwa}”? Wszyscy dostaną powiadomienie.`
      : `Wypisać się ze składu „${druzyna.nazwa}”?`;
    if (!window.confirm(pytanie)) return;
    void wykonaj(() => createClient().rpc("wypisz_sie_z_zawodow", { p_zawody: zawodyId }));
  }

  async function dobierz() {
    for (const u of nowi) {
      const ok = await wykonaj(() => createClient().rpc("dodaj_do_skladu", { p_druzyna: druzyna.id, p_user: u }));
      if (!ok) return;
    }
    setNowi([]);
  }

  return (
    <section className="szklo grid gap-3 rounded-md px-4 py-4">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-krew-jasna">Twój skład</p>
      <h2 className="font-tytul text-xl text-kosc">{druzyna.nazwa}</h2>
      <p className="text-sm text-kosc/85">{czlonkowie.map((c) => c.nazwa).join(", ")}</p>
      {brakuje > 0 && (
        <p className="text-sm text-krew-jasna">
          Brakuje {brakuje} {brakuje === 1 ? "osoby" : "osób"} - skład niepełny.
        </p>
      )}
      {zapisyOtwarte && jestemZalozycielem && brakuje > 0 && (
        <>
          <WyborOsob gracze={wolni} wybrani={nowi} ile={brakuje} onZmiana={setNowi} />
          <Button onClick={dobierz} disabled={czeka || nowi.length === 0}>
            Dobierz do składu
          </Button>
        </>
      )}
      <Blad tresc={blad} />
      {zapisyOtwarte ? (
        <Button variant="szklo" onClick={wypisz} disabled={czeka}>
          {jestemZalozycielem ? "Rozwiąż skład" : "Wypisz się ze składu"}
        </Button>
      ) : (
        <p className="text-xs text-dym">Zapisy zamknięte - zmiany składu tylko przez Organizatora.</p>
      )}
    </section>
  );
}

export function ZapisIndywidualny({
  zawodyId,
  zapisany,
  zajete,
  limit,
  zapisyOtwarte,
}: {
  zawodyId: string;
  zapisany: boolean;
  zajete: number;
  limit: number | null;
  zapisyOtwarte: boolean;
}) {
  const { blad, czeka, wykonaj } = useAkcja();
  const pelne = limit !== null && zajete >= limit;

  return (
    <section className="grid gap-3">
      <p className="text-sm text-kosc">
        Zajęte miejsca: {zajete}
        {limit !== null && ` z ${limit}`}
        {zapisany && " - w tym Twoje."}
      </p>
      <Blad tresc={blad} />
      {zapisyOtwarte && !zapisany && (
        <Button
          onClick={() =>
            wykonaj(() => createClient().rpc("zapisz_sie_na_zawody", { p_zawody: zawodyId })).then(
              (ok) => ok && zdarzenie("zawody", { akcja: "indywidualnie" }),
            )
          }
          disabled={czeka || pelne}
        >
          {pelne ? "Brak miejsc" : czeka ? "Zapisuję..." : "Zapisz się"}
        </Button>
      )}
      {zapisyOtwarte && zapisany && (
        <Button
          variant="szklo"
          onClick={() => {
            if (window.confirm("Wypisać się i zwolnić miejsce?")) {
              void wykonaj(() => createClient().rpc("wypisz_sie_z_zawodow", { p_zawody: zawodyId }));
            }
          }}
          disabled={czeka}
        >
          Wypisz się
        </Button>
      )}
    </section>
  );
}
