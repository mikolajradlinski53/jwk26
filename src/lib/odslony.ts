import type { createClient } from "@/lib/supabase/server";
import { odliczanie, type Odliczanie } from "@/lib/odliczanie";

type Klient = Awaited<ReturnType<typeof createClient>>;

export type Co = "osrodek" | "cena" | "zapisy" | "plan" | "infopack";
export type Odslona = { data: string | null; odsloniete: boolean };
export type Odslony = Record<Co, Odslona>;

/** Odsłona z tekstami policzonymi na serwerze - pierwsza klatka bez skoku. */
export type OdslonaWidok = Odslona & { poczatkowy: string; kiedy: string };
export type OdslonyWidok = Record<Co, OdslonaWidok>;

/** Daty wyjazdu jak w regulaminie (§ 1 ust. 3) - jawne od początku. */
export const DATY_WYJAZDU = "23-25 października";

const CO: Co[] = ["osrodek", "cena", "zapisy", "plan", "infopack"];

/**
 * Awaria odczytu = wszystko zakryte. Bezpieczniej pokazać zasłonę za długo,
 * niż odsłonić za wcześnie; i tak baza nie wyda zakrytych danych.
 */
export const WSZYSTKO_ZAKRYTE: Odslony = {
  osrodek: { data: null, odsloniete: false },
  cena: { data: null, odsloniete: false },
  zapisy: { data: null, odsloniete: false },
  plan: { data: null, odsloniete: false },
  infopack: { data: null, odsloniete: false },
};

/**
 * Lustro `public.odsloniete()` - wyłącznie dla liczników po stronie klienta.
 * Decyzję, co wysłać, zawsze podejmuje baza.
 */
export function czyOdsloniete(daty: Record<Co, string | null>, co: Co, teraz: Date): boolean {
  const minela = (d: string | null) => d === null || d === "" || teraz.getTime() >= new Date(d).getTime();
  // Plan i infopack mają własny termin i nie odsłaniają się z zapisami.
  if (co === "plan" || co === "infopack") return minela(daty[co]);
  return minela(daty[co]) || minela(daty.zapisy);
}

export async function wczytajOdslony(supabase: Klient): Promise<Odslony> {
  const { data, error } = await supabase.rpc("odslony");
  if (error || !data) {
    console.error(
      "Nie udało się wczytać odsłon:",
      error ? { code: error.code, message: error.message } : "brak danych",
    );
    return WSZYSTKO_ZAKRYTE;
  }
  const surowe = data as Partial<Record<Co, Odslona>>;
  return Object.fromEntries(CO.map((c) => [c, surowe[c] ?? WSZYSTKO_ZAKRYTE[c]])) as Odslony;
}

const KIEDY = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** „5 października o 18:00” - dla czytnika ekranu i podpisów. */
export function kiedyOdslona(data: string | null): string {
  if (!data) return "wkrótce";
  const czesci = KIEDY.formatToParts(new Date(data));
  const pole = (t: Intl.DateTimeFormatPartTypes) => czesci.find((c) => c.type === t)?.value ?? "";
  return `${pole("day")} ${pole("month")} o ${pole("hour")}:${pole("minute")}`;
}

/** „3 d 04:05:06”; po terminie „za chwilę” (serwer zaraz odsłoni sekcję). */
export function tekstOdliczania(o: Odliczanie): string {
  if (o.minelo) return "za chwilę";
  const dwa = (n: number) => String(n).padStart(2, "0");
  return `${o.dni} d ${dwa(o.godziny)}:${dwa(o.minuty)}:${dwa(o.sekundy)}`;
}

export function widokOdslon(odslony: Odslony, teraz: Date): OdslonyWidok {
  return Object.fromEntries(
    CO.map((c) => {
      const o = odslony[c];
      const poczatkowy = o.data ? tekstOdliczania(odliczanie(o.data, teraz)) : "wkrótce";
      return [c, { ...o, poczatkowy, kiedy: kiedyOdslona(o.data) }];
    }),
  ) as OdslonyWidok;
}

/**
 * Miasto z adresu z panelu („Poznańska 5, 58-540 Karpacz” → „Karpacz”).
 * Nazwa miasta nie siedzi nigdzie w kodzie - przed odsłoną baza nie wyda
 * adresu, więc nie ma skąd jej wziąć.
 */
export function miastoZAdresu(adres: string | null): string | null {
  const m = adres?.match(/\d{2}-\d{3}\s+(.+)$/);
  return m ? m[1].trim() : null;
}
