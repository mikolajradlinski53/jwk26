import type { SupabaseClient } from "@supabase/supabase-js";
import { NAZWY_PUL, etykietaAlkoholu, etykietaDojazdu } from "./formularz";
import type { Alkohol, DaneWrazliwe, Dojazd, KluczPuli } from "@/types/db";

/** Przyjęta osoba w kształcie gotowym do ekranu i do CSV. */
export type Uczestnik = {
  id: string;
  userId: string;
  imie: string;
  nazwisko: string;
  ksywka: string | null;
  pula: KluczPuli | null;
  druzyna: string | null;
  telefon: string | null;
  dojazd: Dojazd | null;
  /** „12:30-16:00" albo `null`, gdy zwolnienie niepotrzebne. */
  zwolnienie: string | null;
  alkohol: Alkohol | null;
  zgodaWizerunek: boolean;
  /** Dieta ze zgłoszeń sprzed planu 08 (`registrations.diet_notes`). */
  dietaStara: string | null;
  wrazliwe: DaneWrazliwe | null;
};

export type FiltryUczestnikow = { pula?: KluczPuli; druzyna?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filtry z query stringa - wspólne dla ekranu i trasy CSV, żeby eksport zawsze
 * był dokładnie tym, co widać na ekranie. Nieznane wartości są pomijane, nie
 * przekazywane do zapytania.
 */
export function parsujFiltry(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
): FiltryUczestnikow {
  const wez = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return typeof v === "string" ? v : undefined;
  };
  const pula = wez("pula");
  const druzyna = wez("druzyna");
  return {
    ...(pula && pula in NAZWY_PUL ? { pula: pula as KluczPuli } : {}),
    ...(druzyna && UUID.test(druzyna) ? { druzyna } : {}),
  };
}

type Surowy = {
  id: string;
  user_id: string;
  imie: string | null;
  nazwisko: string | null;
  full_name: string;
  ksywka: string | null;
  pula: KluczPuli | null;
  phone: string | null;
  dojazd: Dojazd | null;
  zwolnienie_od: string | null;
  zwolnienie_do: string | null;
  alkohol: Alkohol | null;
  zgoda_wizerunek: boolean;
  diet_notes: string | null;
  profil: { team_id: string | null; druzyna: { name: string } | { name: string }[] | null } | null;
  dane_wrazliwe: DaneWrazliwe | DaneWrazliwe[] | null;
};

/** PostgREST zwraca relację jeden-do-jednego raz jako obiekt, raz jako tablicę. */
function jeden<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Przyjęte zgłoszenia z drużyną i danymi wrażliwymi. Wskazówki przy złączeniach
 * są konieczne: registrations ma dwa klucze do profiles (user_id, reviewed_by),
 * a profiles i teams wskazują na siebie nawzajem (team_id, captain_id).
 *
 * Bez migracji: RLS wpuszcza admina do registrations i dane_wrazliwe, a każdego
 * innego wyłącznie do własnych wierszy.
 */
export async function wczytajUczestnikow(
  supabase: SupabaseClient,
  filtry: FiltryUczestnikow,
): Promise<Uczestnik[]> {
  let zapytanie = supabase
    .from("registrations")
    .select(
      "id, user_id, imie, nazwisko, full_name, ksywka, pula, phone, dojazd, " +
        "zwolnienie_od, zwolnienie_do, alkohol, zgoda_wizerunek, diet_notes, " +
        "profil:profiles!registrations_user_id_fkey!inner(team_id, druzyna:teams!profiles_team_id_fkey(name)), " +
        "dane_wrazliwe(*)",
    )
    .eq("status", "approved")
    .order("nazwisko", { ascending: true, nullsFirst: false })
    .order("imie", { ascending: true });

  if (filtry.pula) zapytanie = zapytanie.eq("pula", filtry.pula);
  if (filtry.druzyna) zapytanie = zapytanie.eq("profil.team_id", filtry.druzyna);

  const { data, error } = await zapytanie;
  if (error) throw error;

  return ((data ?? []) as unknown as Surowy[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    // Zgłoszenia sprzed planu 08 mają tylko full_name.
    imie: r.imie ?? "",
    nazwisko: r.nazwisko ?? r.full_name,
    ksywka: r.ksywka,
    pula: r.pula,
    druzyna: jeden(r.profil?.druzyna)?.name ?? null,
    telefon: r.phone,
    dojazd: r.dojazd,
    zwolnienie:
      r.zwolnienie_od && r.zwolnienie_do
        ? `${r.zwolnienie_od.slice(0, 5)}-${r.zwolnienie_do.slice(0, 5)}`
        : null,
    alkohol: r.alkohol,
    zgodaWizerunek: r.zgoda_wizerunek,
    dietaStara: r.diet_notes,
    wrazliwe: jeden(r.dane_wrazliwe),
  }));
}

export const NAGLOWKI_CSV = [
  "Nazwisko",
  "Imię",
  "Ksywka",
  "Pula",
  "Drużyna",
  "Telefon",
  "Dojazd",
  "Zwolnienie 23.10",
  "Alkohol",
  "Zgoda na wizerunek",
  "Dieta",
  "Alergie",
  "Choroby i leki",
  "ICE",
];

/** Kontakt ICE w jednej komórce: „Anna (mama), 600200300". */
export function opisIce(w: DaneWrazliwe | null): string | null {
  if (!w?.ice_telefon) return null;
  return `${w.ice_imie ?? ""}${w.ice_relacja ? ` (${w.ice_relacja})` : ""}, ${w.ice_telefon}`;
}

/** Jeden wiersz CSV - w kolejności NAGLOWKI_CSV. */
export function wierszCsv(u: Uczestnik): (string | null)[] {
  return [
    u.nazwisko,
    u.imie,
    u.ksywka,
    u.pula ? NAZWY_PUL[u.pula] : null,
    u.druzyna,
    u.telefon,
    u.dojazd ? etykietaDojazdu(u.dojazd) : null,
    u.zwolnienie,
    u.alkohol ? etykietaAlkoholu(u.alkohol) : null,
    u.zgodaWizerunek ? "tak" : "nie",
    u.wrazliwe?.dieta ?? u.dietaStara,
    u.wrazliwe?.alergie ?? null,
    u.wrazliwe?.choroby_leki ?? null,
    opisIce(u.wrazliwe),
  ];
}
