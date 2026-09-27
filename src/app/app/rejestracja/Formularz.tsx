"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  PUSTY_FORMULARZ,
  kroki,
  waliduj,
  doRpc,
  type Bledy,
  type DaneFormularza,
  type Krok,
} from "@/lib/zapisy/formularz";
import { komunikat, tekstBledu } from "@/lib/zapisy/bledy";
import { wgrajDowod, polaOcr, type WgranyDowod } from "@/lib/zapisy/przelew";
import { KrokPula, KrokZasady, KrokDane, KrokIce, KrokZdrowie, KrokOTobie } from "./Kroki";
import { WyborZdjecia } from "./WyborZdjecia";
import type { StanPuli } from "@/types/db";

const TYTULY: Record<Krok, string> = {
  pula: "Tura",
  zasady: "Zasady",
  dane: "Dane",
  ice: "Kontakt ICE",
  zdrowie: "Zdrowie",
  oTobie: "O tobie",
  przelew: "Przelew",
};

/**
 * Formularz krokowy. Nic nie idzie do bazy przed ostatnim krokiem — cofanie
 * się i poprawianie nie zostawia po drodze półzgłoszeń.
 *
 * `pule` to stan z chwili renderu. Mógł się zmienić, zanim ktoś doszedł do
 * końca; rozstrzyga funkcja, a formularz reaguje na PULA_PELNA (D3).
 */
export function Formularz({ pule, dataJwk }: { pule: StanPuli[]; dataJwk: string }) {
  const router = useRouter();
  const [dane, setDane] = useState<DaneFormularza>(PUSTY_FORMULARZ);
  const [bledy, setBledy] = useState<Bledy>({});
  const [indeks, setIndeks] = useState(0);
  const [plik, setPlik] = useState<File | null>(null);
  const [bladPliku, setBladPliku] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [etap, setEtap] = useState<string | null>(null);
  const [propozycjaRezerwy, setPropozycjaRezerwy] = useState(false);

  // Rygiel niezależny od stanu Reacta: `etap` w domknięciu bywa nieaktualny,
  // a chodzi o okno krótsze niż jeden render.
  const wToku = useRef(false);
  // Raz wgrane zdjęcie. Ponowna próba po błędzie albo przejście na rezerwę nie
  // wgrywają go drugi raz — przy rezerwie zostaje przy zgłoszeniu (D3).
  const wgrane = useRef<WgranyDowod | null>(null);

  const wybrana = pule.find((p) => p.klucz === dane.pula);
  const naRezerwe = wybrana ? wybrana.zajete >= wybrana.miejsca : false;
  const lista = kroki(naRezerwe);
  const krok = lista[Math.min(indeks, lista.length - 1)];
  const ostatni = indeks >= lista.length - 1;
  const czeka = etap !== null;

  function zmien<K extends keyof DaneFormularza>(pole: K, wartosc: DaneFormularza[K]) {
    setDane((d) => ({ ...d, [pole]: wartosc }));
    setBledy((b) => ({ ...b, [pole]: undefined }));
  }

  /** Waliduje bieżący krok; zwraca, czy można iść dalej. */
  function sprawdz(): boolean {
    const b = waliduj(krok, dane, dataJwk);
    setBledy(b);
    return Object.keys(b).length === 0;
  }

  function dalej() {
    if (!sprawdz()) return;
    setIndeks((i) => i + 1);
    window.scrollTo({ top: 0 });
  }

  function wstecz() {
    setBlad(null);
    setIndeks((i) => Math.max(0, i - 1));
  }

  async function wyslij(wymusRezerwe: boolean) {
    if (wToku.current) return;
    setBlad(null);

    const doRezerwy = naRezerwe || wymusRezerwe;
    if (!doRezerwy && !plik && !wgrane.current) {
      setBladPliku("Dołącz zdjęcie potwierdzenia przelewu");
      return;
    }

    wToku.current = true;
    setEtap("Zapisuję...");

    try {
      if (plik && !wgrane.current) {
        wgrane.current = await wgrajDowod(plik, setEtap);
      }

      setEtap("Zapisuję zgłoszenie...");
      const { p_dane, p_wrazliwe } = doRpc(dane);
      const { error } = await createClient().rpc("zloz_zgloszenie", {
        p_dane,
        p_wrazliwe,
        p_proof_path: wgrane.current?.sciezka ?? null,
        ...polaOcr(wgrane.current),
        p_na_rezerwe: doRezerwy,
      });
      if (error) throw error;

      // Rygiel zostaje zamknięty: strona serwerowa zaraz podmieni formularz
      // na poczekalnię.
      router.refresh();
    } catch (e) {
      console.error("Zgłoszenie nie przeszło:", e);
      const tekst = tekstBledu(e);
      if (/PULA_PELNA/.test(tekst)) {
        setPropozycjaRezerwy(true);
      } else {
        setBlad(komunikat(e));
        // Formularz szedł na rezerwę, a miejsce zwolniło się w międzyczasie.
        // Świeży stan pul z serwera dołoży krok przelewu; stan formularza
        // (komponent kliencki) przeżywa odświeżenie.
        if (/PRZELEW_WYMAGANY/.test(tekst)) router.refresh();
      }
      // Odblokowanie w każdej gałęzi błędu. W trybie aplikacji na iOS nie ma
      // przeładowania, które by to naprawiło.
      setEtap(null);
      wToku.current = false;
    }
  }

  function zakoncz() {
    if (!sprawdz()) return;
    void wyslij(false);
  }

  const wspolne = { dane, zmien, bledy };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-dym" aria-live="polite">
          Krok {indeks + 1} z {lista.length}: {TYTULY[krok]}
        </p>
        <div className="h-1 rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-krew transition-[width]"
            style={{ width: `${((indeks + 1) / lista.length) * 100}%` }}
          />
        </div>
      </div>

      {krok === "pula" && <KrokPula {...wspolne} pule={pule} />}
      {krok === "zasady" && <KrokZasady {...wspolne} />}
      {krok === "dane" && <KrokDane {...wspolne} dataJwk={dataJwk} />}
      {krok === "ice" && <KrokIce {...wspolne} />}
      {krok === "zdrowie" && <KrokZdrowie {...wspolne} />}
      {krok === "oTobie" && <KrokOTobie {...wspolne} />}
      {krok === "przelew" && (
        <WyborZdjecia
          plik={plik}
          blad={bladPliku}
          onWybor={(f) => {
            setPlik(f);
            setBladPliku(null);
            // Nowy plik unieważnia poprzedni upload.
            wgrane.current = null;
          }}
        />
      )}

      {krok === "oTobie" && naRezerwe && (
        <p className="szklo rounded-md px-4 py-3 text-sm leading-relaxed text-dym">
          Ta pula jest pełna, więc zapiszesz się na listę rezerwową — bez przelewu.
          Gdy zwolni się miejsce, organizator przesunie Cię na listę, a wtedy
          poprosimy o potwierdzenie wpłaty.
        </p>
      )}

      {propozycjaRezerwy && (
        <div className="szklo grid gap-3 rounded-md px-4 py-3.5 text-sm">
          <p className="text-kosc">Pula zapełniła się w trakcie wypełniania formularza.</p>
          <p className="text-dym">
            Możesz zapisać się na listę rezerwową. Wgrane zdjęcie przelewu zostaje
            przy zgłoszeniu i wróci, jeśli zwolni się miejsce.
          </p>
          <Button onClick={() => void wyslij(true)} disabled={czeka}>
            {etap ?? "Zapisz mnie na rezerwę"}
          </Button>
        </div>
      )}

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="szklo" onClick={wstecz} disabled={indeks === 0 || czeka}>
          Wstecz
        </Button>
        {ostatni ? (
          <Button onClick={zakoncz} disabled={czeka || propozycjaRezerwy}>
            {etap ?? (naRezerwe ? "Zapisz na rezerwę" : "Złóż ofiarę")}
          </Button>
        ) : (
          <Button onClick={dalej}>Dalej</Button>
        )}
      </div>
    </div>
  );
}
