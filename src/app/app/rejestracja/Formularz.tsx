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
import { DanePrzelewu } from "@/components/DanePrzelewu";
import { tytulPrzelewu, type DanePrzelewu as DanePrzelewuTyp } from "@/lib/zapisy/qrPrzelewu";
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
 * Formularz krokowy. Nic nie idzie do bazy przed ostatnim krokiem - cofanie
 * się i poprawianie nie zostawia po drodze półzgłoszeń.
 *
 * `pule` to stan z chwili renderu. Mógł się zmienić, zanim ktoś doszedł do
 * końca; rozstrzyga funkcja, a formularz reaguje na PULA_PELNA (D3).
 */
export function Formularz({
  pule,
  samorzadowe,
  dataJwk,
  przelew,
}: {
  pule: StanPuli[];
  /** Konto @samorzad.ue.wroc.pl; prywatny mail zapisuje się tylko do Świeżaków. */
  samorzadowe: boolean;
  dataJwk: string;
  /** `null`, dopóki admin nie poda numeru konta - krok pokazuje wtedy „wkrótce". */
  przelew: DanePrzelewuTyp | null;
}) {
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
  // wgrywają go drugi raz - przy rezerwie zostaje przy zgłoszeniu (D3).
  const wgrane = useRef<WgranyDowod | null>(null);
  // Tytuł bieżącego kroku - cel skupienia po zmianie kroku, żeby czytnik
  // ekranu i klawiatura zaczynały od nagłówka, nie od miejsca sprzed kliknięcia.
  const tytulRef = useRef<HTMLParagraphElement>(null);

  const wybrana = pule.find((p) => p.klucz === dane.pula);
  const naRezerwe = wybrana ? wybrana.zajete >= wybrana.miejsca : false;
  const lista = kroki(naRezerwe);
  // `indeks` może wskazywać poza listę, jeśli zmiana puli skróciła kroki
  // (rezerwa nie ma przelewu) - jedno miejsce klamrujące zamiast powtarzania
  // tego samego `Math.min` w czterech miejscach.
  const pozycja = Math.min(indeks, lista.length - 1);
  const krok = lista[pozycja];
  const ostatni = pozycja >= lista.length - 1;
  const czeka = etap !== null;

  /**
   * Po nieudanej walidacji: przewija i skupia pierwsze pole z błędem. Na
   * `requestAnimationFrame`, bo DOM z nowym `aria-invalid`/`data-blad`
   * pojawia się dopiero po przemalowaniu, które React planuje po tym wywołaniu.
   */
  function skupNaBledzie() {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-blad]');
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    });
  }

  /** Po udanej zmianie kroku: powrót na górę i skupienie tytułu kroku. */
  function skupTytulKroku() {
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => {
      tytulRef.current?.focus();
    });
  }

  function zmien<K extends keyof DaneFormularza>(pole: K, wartosc: DaneFormularza[K]) {
    setDane((d) => ({ ...d, [pole]: wartosc }));
    setBledy((b) => ({ ...b, [pole]: undefined }));
    // Inna pula ma inny stan zajętości - propozycja rezerwy z poprzedniej
    // próby nic już nie mówi o nowo wybranej puli.
    if (pole === "pula") setPropozycjaRezerwy(false);
  }

  /** Waliduje bieżący krok; zwraca, czy można iść dalej. */
  function sprawdz(): boolean {
    const b = waliduj(krok, dane, dataJwk);
    setBledy(b);
    return Object.keys(b).length === 0;
  }

  /**
   * Pierwszy krok (poza przelewem - plik nie jest częścią `DaneFormularza`),
   * który nie przechodzi walidacji przy aktualnym stanie `dane`. Wychwytuje
   * przypadek, w którym ktoś cofnął się, zmienił coś wcześniej i doszedł do
   * końca bez ponownego sprawdzenia - bez tego RPC odrzuciłby zgłoszenie
   * dopiero po wgraniu zdjęcia, co wygląda jak błąd bez wytłumaczenia.
   */
  function pierwszyBlednyKrok(): { indeks: number; bledy: Bledy } | null {
    for (let i = 0; i < lista.length; i++) {
      const k = lista[i];
      if (k === "przelew") continue;
      const b = waliduj(k, dane, dataJwk);
      if (Object.keys(b).length > 0) return { indeks: i, bledy: b };
    }
    return null;
  }

  function dalej() {
    if (!sprawdz()) {
      skupNaBledzie();
      return;
    }
    setPropozycjaRezerwy(false);
    setIndeks((i) => i + 1);
    skupTytulKroku();
  }

  function wstecz() {
    setBlad(null);
    setPropozycjaRezerwy(false);
    // Najpierw klamra do bieżącej długości listy: gdy odświeżenie skróciło
    // kroki (np. pula przestała być pełna i zniknął krok rezerwy), `indeks`
    // sprzed odświeżenia bywa większy niż `lista.length - 1`, a odjęcie
    // jedynki od takiej wartości nie cofa widocznego kroku.
    setIndeks((i) => Math.max(0, Math.min(i, lista.length - 1) - 1));
    skupTytulKroku();
  }

  async function wyslij(wymusRezerwe: boolean) {
    if (wToku.current) return;
    setBlad(null);

    // Ostatnia deska ratunku przed zapisem: krok mógł przejść walidację, gdy
    // ktoś go widział, a potem coś zmienić i wrócić na koniec bez przejścia
    // przez `dalej()` jeszcze raz.
    const zlyKrok = pierwszyBlednyKrok();
    if (zlyKrok) {
      setIndeks(zlyKrok.indeks);
      setBledy(zlyKrok.bledy);
      setPropozycjaRezerwy(false);
      skupNaBledzie();
      return;
    }

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
      const tekst = tekstBledu(e);
      // Surowy błąd (zwłaszcza `details` naruszenia CHECK) potrafi zawierać
      // cały wiersz łącznie z danymi zdrowotnymi (art. 9 RODO) - do konsoli
      // idzie wyłącznie kod i komunikat, nigdy cały obiekt błędu.
      const zapis = { code: (e as { code?: string } | null)?.code, message: tekst };

      // PWA na iOS bez przeładowania: zawieszony `fetch` potrafi zgubić samą
      // odpowiedź, mimo że zapis po drugiej stronie przeszedł. Drugie
      // kliknięcie odbiłoby się o ten sam unikalny indeks - więc traktujemy to
      // jak sukces i NIE zwalniamy rygla, żeby nie pokazać pustego formularza
      // tuż przed tym, jak serwer podmieni go na poczekalnię.
      if (/one_pending|duplicate key|juz zaakceptowane/i.test(tekst)) {
        console.error("Zgłoszenie nie przeszło (odpowiedź zgubiona, zapis prawdopodobnie doszedł):", zapis);
        router.refresh();
        return;
      }

      console.error("Zgłoszenie nie przeszło:", zapis);

      if (/PULA_PELNA/.test(tekst)) {
        setPropozycjaRezerwy(true);
        // Inni w tym czasie też się zapisywali - kafelki puli w tle są
        // nieaktualne dokładnie w chwili, gdy pokazujemy propozycję rezerwy.
        router.refresh();
      } else {
        setBlad(komunikat(e));
        // Pula zwolniła miejsce (PRZELEW_WYMAGANY) albo się właśnie zamknęła
        // (PULA_ZAMKNIETA) - w obu przypadkach stan pul z serwera się zmienił;
        // stan formularza (komponent kliencki) przeżywa odświeżenie.
        if (/PRZELEW_WYMAGANY|PULA_ZAMKNIETA/.test(tekst)) router.refresh();
      }
      // Odblokowanie w każdej pozostałej gałęzi błędu. W trybie aplikacji na
      // iOS nie ma przeładowania, które by to naprawiło.
      setEtap(null);
      wToku.current = false;
    }
  }

  function zakoncz() {
    if (!sprawdz()) {
      skupNaBledzie();
      return;
    }
    void wyslij(false);
  }

  const wspolne = { dane, zmien, bledy };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p
          ref={tytulRef}
          tabIndex={-1}
          className="text-xs uppercase tracking-[0.14em] text-dym"
          aria-live="polite"
        >
          Krok {pozycja + 1} z {lista.length}: {TYTULY[krok]}
        </p>
        <div className="h-1 rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-krew transition-[width]"
            style={{ width: `${((pozycja + 1) / lista.length) * 100}%` }}
          />
        </div>
      </div>

      {krok === "pula" && <KrokPula {...wspolne} pule={pule} samorzadowe={samorzadowe} />}
      {krok === "zasady" && <KrokZasady {...wspolne} />}
      {krok === "dane" && <KrokDane {...wspolne} />}
      {krok === "ice" && <KrokIce {...wspolne} />}
      {krok === "zdrowie" && <KrokZdrowie {...wspolne} />}
      {krok === "oTobie" && <KrokOTobie {...wspolne} />}
      {krok === "przelew" && (
        <>
          <DanePrzelewu dane={przelew} tytul={tytulPrzelewu(dane.imie, dane.nazwisko)} />
          <WyborZdjecia
            plik={plik}
            blad={bladPliku}
            disabled={czeka}
            onWybor={(f) => {
              setPlik(f);
              setBladPliku(null);
              // Nowy plik unieważnia poprzedni upload.
              wgrane.current = null;
            }}
          />
        </>
      )}

      {krok === "oTobie" && naRezerwe && (
        <p className="szklo rounded-md px-4 py-3 text-sm leading-relaxed text-dym">
          Ta pula jest pełna, więc zapiszesz się na listę rezerwową - bez przelewu.
          Gdy zwolni się miejsce, organizator przesunie Cię na listę, a wtedy
          poprosimy o potwierdzenie wpłaty.
        </p>
      )}

      {/* Tylko na ostatnim kroku - `propozycjaRezerwy` gasi się przy każdej
          zmianie kroku i puli, ale klamra zostaje na wypadek stanów brzegowych. */}
      {ostatni && propozycjaRezerwy && (
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
