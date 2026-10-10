"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Field } from "@/components/ui/Field";
import { DOMENA_SAMORZADU, TURA_DLA_PRYWATNYCH } from "@/lib/konto";
import {
  ALKOHOL,
  DOJAZDY,
  PRZEDZIALY_ZWOLNIENIA,
  pytaOZwolnienie,
  wartoscPolaDaty,
  wyswietlDate,
  type Bledy,
  type DaneFormularza,
} from "@/lib/zapisy/formularz";
import {
  KLAUZULA_INFORMACYJNA,
  OSWIADCZENIE_SZKODY,
  ZGODA_WIZERUNEK,
  KLAUZULA_ZDROWIE,
  ZGODA_ART9,
  ZGODA_SMS,
  POTWIERDZENIE_ICE,
  INFORMACJA_DLA_ICE,
} from "@/lib/zapisy/zgody";
import type { StanPuli } from "@/types/db";

export type PropsKroku = {
  dane: DaneFormularza;
  zmien: <K extends keyof DaneFormularza>(pole: K, wartosc: DaneFormularza[K]) => void;
  bledy: Bledy;
};

const ETYKIETA =
  "mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym";

function Blad({ tresc }: { tresc?: string }) {
  // `data-blad` obok `aria-invalid`: grupy radiowe (pula, dojazd) nie mają
  // jednego pola do oznaczenia jako niepoprawne, ale ten span zawsze stoi
  // tuż przy nich - po nim formularz odnajduje, gdzie przewinąć po błędzie.
  return tresc ? (
    <span data-blad className="mt-1.5 block text-sm text-krew-jasna">
      {tresc}
    </span>
  ) : null;
}

/** Checkbox z celem dotykowym na całą etykietę (44 px). */
function Zgoda({
  zaznaczona,
  onZmiana,
  blad,
  children,
}: {
  zaznaczona: boolean;
  onZmiana: (v: boolean) => void;
  blad?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-kosc">
        <input
          type="checkbox"
          checked={zaznaczona}
          onChange={(e) => onZmiana(e.target.checked)}
          aria-invalid={blad ? true : undefined}
          className="mt-0.5 size-6 shrink-0 accent-[var(--color-krew)]"
        />
        <span>{children}</span>
      </label>
      <Blad tresc={blad} />
    </div>
  );
}

function Pole({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
  blad,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength: number;
  rows?: number;
  blad?: string;
}) {
  return (
    <label className="block">
      <span className={ETYKIETA}>{label}</span>
      <textarea
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={blad ? true : undefined}
        className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc
                   outline-none placeholder:text-dym focus-visible:border-krew"
      />
      <Blad tresc={blad} />
    </label>
  );
}

/** Tekst prawny w przewijanym bloku - nie spycha przycisków poza ekran telefonu. */
function Tekst({ children }: { children: ReactNode }) {
  return (
    <div className="szklo max-h-72 overflow-y-auto rounded-md px-4 py-3 text-xs leading-relaxed text-dym">
      {children}
    </div>
  );
}

export function KrokPula({
  dane,
  zmien,
  bledy,
  pule,
  samorzadowe,
}: PropsKroku & { pule: StanPuli[]; samorzadowe: boolean }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm text-dym">Z której puli jedziesz?</legend>
      {pule.map((p) => {
        const pelna = p.zajete >= p.miejsca;
        const wybrana = dane.pula === p.klucz;
        // Prywatny mail - tylko Świeżaki (to samo pilnuje zloz_zgloszenie).
        const tylkoSamorzad = !samorzadowe && p.klucz !== TURA_DLA_PRYWATNYCH;
        const dostepna = p.otwarta && !tylkoSamorzad;
        return (
          <label
            key={p.klucz}
            className={
              "szklo flex min-h-14 items-center gap-3 rounded-md px-4 py-3 " +
              (dostepna ? "" : "opacity-40 ") +
              (wybrana ? "border-krew" : "")
            }
          >
            <input
              type="radio"
              name="pula"
              checked={wybrana}
              disabled={!dostepna}
              onChange={() => zmien("pula", p.klucz)}
              className="size-5 shrink-0 accent-[var(--color-krew)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold">{p.nazwa}</span>
              <span className="block text-xs text-dym">
                {tylkoSamorzad
                  ? `Tylko dla kont ${DOMENA_SAMORZADU}`
                  : !p.otwarta
                  ? "Zamknięta"
                  : pelna
                    ? `Pełna, zapis na rezerwę (${p.w_rezerwie} w kolejce)`
                    : `${p.zajete} z ${p.miejsca} miejsc`}
              </span>
            </span>
          </label>
        );
      })}
      <Blad tresc={bledy.pula} />
      <p className="text-xs leading-relaxed text-dym">
        Wybierz pulę, do której faktycznie należysz. Organizator sprawdza to przy
        akceptacji i odrzuca zgłoszenia ze złej puli.
      </p>
    </fieldset>
  );
}

export function KrokZasady({ dane, zmien, bledy }: PropsKroku) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h2 className={ETYKIETA}>Klauzula informacyjna</h2>
        <Tekst>
          {KLAUZULA_INFORMACYJNA.map((akapit) => (
            <p key={akapit} className="mb-2 last:mb-0">
              {akapit}
            </p>
          ))}
        </Tekst>
        <Zgoda
          zaznaczona={dane.akceptujeKlauzule}
          onZmiana={(v) => zmien("akceptujeKlauzule", v)}
          blad={bledy.akceptujeKlauzule}
        >
          Znam treść klauzuli informacyjnej.
        </Zgoda>
      </section>

      <section className="grid gap-2">
        <h2 className={ETYKIETA}>Regulamin</h2>
        {/* Link poza etykietą checkboxa: kliknięcie w niego nie może przy
            okazji zaznaczać akceptacji. */}
        <Link
          href="/regulamin"
          target="_blank"
          className="text-sm text-kosc underline underline-offset-2"
        >
          Przeczytaj regulamin JWK26 (otworzy się w nowej karcie)
        </Link>
        <Zgoda
          zaznaczona={dane.akceptujeRegulamin}
          onZmiana={(v) => zmien("akceptujeRegulamin", v)}
          blad={bledy.akceptujeRegulamin}
        >
          Akceptuję regulamin JWK26.
        </Zgoda>
      </section>

      <section className="grid gap-2">
        <h2 className={ETYKIETA}>Odpowiedzialność za szkody</h2>
        <Tekst>
          <p>{OSWIADCZENIE_SZKODY}</p>
        </Tekst>
        <Zgoda
          zaznaczona={dane.akceptujeSzkody}
          onZmiana={(v) => zmien("akceptujeSzkody", v)}
          blad={bledy.akceptujeSzkody}
        >
          Akceptuję oświadczenie o odpowiedzialności za szkody.
        </Zgoda>
      </section>

      <section className="grid gap-2">
        <h2 className={ETYKIETA}>Wizerunek - dobrowolnie</h2>
        <Zgoda zaznaczona={dane.zgodaWizerunek} onZmiana={(v) => zmien("zgodaWizerunek", v)}>
          {ZGODA_WIZERUNEK}
        </Zgoda>
      </section>
    </div>
  );
}

export function KrokDane({ dane, zmien, bledy }: PropsKroku) {
  return (
    <div className="grid gap-5">
      <Field
        label="Imię"
        autoComplete="given-name"
        value={dane.imie}
        maxLength={60}
        onChange={(e) => zmien("imie", e.target.value)}
        error={bledy.imie}
      />
      <Field
        label="Nazwisko"
        autoComplete="family-name"
        value={dane.nazwisko}
        maxLength={60}
        onChange={(e) => zmien("nazwisko", e.target.value)}
        error={bledy.nazwisko}
      />
      <Field
        label={dane.pula === "alumni" ? "Numer indeksu (jeśli pamiętasz)" : "Numer indeksu"}
        inputMode="numeric"
        value={dane.nrIndeksu}
        maxLength={10}
        onChange={(e) => zmien("nrIndeksu", e.target.value)}
        error={bledy.nrIndeksu}
      />
      <Field
        label="Data urodzenia"
        // Zwykłe pole zamiast kalendarza: wpisanie 8 cyfr jest szybsze niż
        // przewijanie lat wstecz. Kropki dokłada maska (maskaDaty).
        inputMode="numeric"
        autoComplete="bday"
        placeholder="DD.MM.RRRR"
        maxLength={10}
        value={wyswietlDate(dane.dataUrodzenia)}
        onChange={(e) => zmien("dataUrodzenia", wartoscPolaDaty(e.target.value))}
        error={bledy.dataUrodzenia}
      />
      <Field
        label="Telefon"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="600 100 200"
        value={dane.telefon}
        onChange={(e) => zmien("telefon", e.target.value)}
        error={bledy.telefon}
      />
      <Zgoda zaznaczona={dane.zgodaSms} onZmiana={(v) => zmien("zgodaSms", v)}>
        {ZGODA_SMS}
      </Zgoda>
    </div>
  );
}

export function KrokIce({ dane, zmien, bledy }: PropsKroku) {
  return (
    <div className="grid gap-5">
      <p className="text-sm leading-relaxed text-dym">
        Dobrowolne. Osoba, do której zadzwonimy, gdyby coś Ci się stało w czasie
        wyjazdu. Możesz pominąć ten krok.
      </p>
      <Field
        label="Imię tej osoby"
        value={dane.iceImie}
        maxLength={60}
        onChange={(e) => zmien("iceImie", e.target.value)}
        error={bledy.iceImie}
      />
      <Field
        label="Kim jest dla Ciebie?"
        placeholder="np. mama, partner, współlokatorka"
        value={dane.iceRelacja}
        maxLength={40}
        onChange={(e) => zmien("iceRelacja", e.target.value)}
        error={bledy.iceRelacja}
      />
      <Field
        label="Jej telefon"
        type="tel"
        inputMode="tel"
        value={dane.iceTelefon}
        onChange={(e) => zmien("iceTelefon", e.target.value)}
        error={bledy.iceTelefon}
      />
      <Zgoda
        zaznaczona={dane.icePoinformowany}
        onZmiana={(v) => zmien("icePoinformowany", v)}
        blad={bledy.icePoinformowany}
      >
        {POTWIERDZENIE_ICE}
      </Zgoda>
      <Tekst>
        <p>{INFORMACJA_DLA_ICE}</p>
      </Tekst>
    </div>
  );
}

export function KrokZdrowie({ dane, zmien, bledy }: PropsKroku) {
  return (
    <div className="grid gap-5">
      <Tekst>
        <p>{KLAUZULA_ZDROWIE}</p>
      </Tekst>
      <Pole
        label="Dieta"
        placeholder="np. wegetariańska, bez laktozy"
        maxLength={500}
        rows={2}
        value={dane.dieta}
        onChange={(v) => zmien("dieta", v)}
      />
      <Pole
        label="Alergie"
        placeholder="np. orzechy, penicylina"
        maxLength={500}
        rows={2}
        value={dane.alergie}
        onChange={(v) => zmien("alergie", v)}
      />
      <Pole
        label="Choroby przewlekłe i przyjmowane leki"
        maxLength={500}
        value={dane.chorobyLeki}
        onChange={(v) => zmien("chorobyLeki", v)}
      />
      <Zgoda
        zaznaczona={dane.zgodaArt9}
        onZmiana={(v) => zmien("zgodaArt9", v)}
        blad={bledy.zgodaArt9}
      >
        {ZGODA_ART9}
      </Zgoda>
    </div>
  );
}

export function KrokOTobie({ dane, zmien, bledy }: PropsKroku) {
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className={ETYKIETA}>Jaki planujesz dojazd?</legend>
        {DOJAZDY.map((d) => (
          <label key={d.wartosc} className="flex min-h-11 items-center gap-3 text-sm text-kosc">
            <input
              type="radio"
              name="dojazd"
              checked={dane.dojazd === d.wartosc}
              onChange={() => zmien("dojazd", d.wartosc)}
              className="size-5 shrink-0 accent-[var(--color-krew)]"
            />
            <span>{d.etykieta}</span>
          </label>
        ))}
        <Blad tresc={bledy.dojazd} />
      </fieldset>

      <Field
        label="Jak mamy cię podpisać na identyfikatorze?"
        maxLength={24}
        value={dane.ksywka}
        onChange={(e) => zmien("ksywka", e.target.value)}
        error={bledy.ksywka}
      />
      <p className="-mt-3 text-xs text-dym">Ten podpis zobaczą też inni w rankingu apki.</p>

      {pytaOZwolnienie(dane.pula) && (
        <section className="grid gap-3">
          <h2 className={ETYKIETA}>Zwolnienie rektorskie - dobrowolnie</h2>
          <Zgoda zaznaczona={dane.zwolnienie} onZmiana={(v) => zmien("zwolnienie", v)}>
            Potrzebuję zwolnienia rektorskiego na I dzień wyjazdu, tj. 23.10.2026.
          </Zgoda>
          {dane.zwolnienie && (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-xs text-dym">
                Zaznacz zajęcia, z których potrzebujesz zwolnienia - można kilka.
              </legend>
              {PRZEDZIALY_ZWOLNIENIA.map((p) => (
                <label key={p} className="flex min-h-11 items-center gap-3 text-sm text-kosc">
                  <input
                    type="checkbox"
                    checked={dane.zwolnienieSloty.includes(p)}
                    onChange={(e) =>
                      zmien(
                        "zwolnienieSloty",
                        e.target.checked
                          ? [...dane.zwolnienieSloty, p]
                          : dane.zwolnienieSloty.filter((x) => x !== p),
                      )
                    }
                    className="size-5 shrink-0 accent-[var(--color-krew)]"
                  />
                  <span className="tabular-nums">{p.replace("-", " - ")}</span>
                </label>
              ))}
              <Blad tresc={bledy.zwolnienieSloty} />
            </fieldset>
          )}
        </section>
      )}

      <fieldset className="grid gap-2">
        <legend className={ETYKIETA}>Czy pijesz alkohol? - dobrowolnie</legend>
        {[...ALKOHOL, { wartosc: "" as const, etykieta: "Wolę nie odpowiadać" }].map((a) => (
          <label
            key={a.wartosc || "brak"}
            className="flex min-h-11 items-center gap-3 text-sm text-kosc"
          >
            <input
              type="radio"
              name="alkohol"
              checked={dane.alkohol === a.wartosc}
              onChange={() => zmien("alkohol", a.wartosc)}
              className="size-5 shrink-0 accent-[var(--color-krew)]"
            />
            <span>{a.etykieta}</span>
          </label>
        ))}
      </fieldset>

      <Pole
        label="Jaki utwór rozpęta rytuał na parkiecie?"
        maxLength={200}
        rows={2}
        value={dane.piosenka}
        onChange={(v) => zmien("piosenka", v)}
      />
      <Pole
        label="Chcesz coś dodać od siebie?"
        maxLength={1000}
        value={dane.uwagi}
        onChange={(v) => zmien("uwagi", v)}
      />
    </div>
  );
}
