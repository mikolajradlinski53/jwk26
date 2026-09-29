import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { NAZWY_PUL, etykietaAlkoholu, etykietaDojazdu } from "@/lib/zapisy/formularz";
import {
  opisIce,
  parsujFiltry,
  wczytajUczestnikow,
  type Uczestnik,
} from "@/lib/zapisy/uczestnicy";
import type { KluczPuli, Team } from "@/types/db";
import { Wroc } from "@/components/Wroc";

const POLE =
  "szklo min-h-11 w-full rounded-sm px-3 text-sm text-kosc outline-none focus-visible:border-krew";
const ETYKIETA = "mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym";

export default async function UczestnicyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filtry = parsujFiltry(await searchParams);
  const supabase = await createClient();

  const [{ data: druzynyRaw }, wynik] = await Promise.all([
    supabase.from("teams").select("id, name").order("name"),
    wczytajUczestnikow(supabase, filtry).then(
      (lista) => ({ lista, blad: false }),
      (e: { code?: string; message?: string }) => {
        console.error("Nie udało się wczytać listy uczestników:", {
          code: e.code,
          message: e.message,
        });
        return { lista: [] as Uczestnik[], blad: true };
      },
    ),
  ]);
  const druzyny = (druzynyRaw ?? []) as Pick<Team, "id" | "name">[];

  // Ten sam query string dla CSV — eksport ma być dokładnie tym, co widać.
  const zapytanie = new URLSearchParams(
    Object.entries(filtry).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <Ekran tytul="Uczestnicy" podtytul="Przyjęte zgłoszenia">
      {/* Zwykły formularz GET: filtry działają bez JavaScriptu i lądują w URL-u,
          więc da się podesłać link do „Świeżaków z Kręgu Świec". */}
      <form method="get" className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={ETYKIETA}>Pula</span>
          <select name="pula" defaultValue={filtry.pula ?? ""} className={POLE}>
            <option value="">Wszystkie</option>
            {(Object.keys(NAZWY_PUL) as KluczPuli[]).map((k) => (
              <option key={k} value={k}>
                {NAZWY_PUL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ETYKIETA}>Drużyna</span>
          <select name="druzyna" defaultValue={filtry.druzyna ?? ""} className={POLE}>
            <option value="">Wszystkie</option>
            {druzyny.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="szklo col-span-2 min-h-11 rounded-full text-sm font-bold text-kosc hover:bg-white/12
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
        >
          Filtruj
        </button>
      </form>

      {wynik.blad ? (
        <p className="szklo mt-5 rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać listy. Odśwież stronę.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-dym">
              {wynik.lista.length === 1 ? "1 osoba" : `${wynik.lista.length} osób`}
            </p>
            <a
              href={`/app/admin/uczestnicy/csv${zapytanie ? `?${zapytanie}` : ""}`}
              className="flex min-h-11 items-center rounded-full border border-white/20 px-4 text-xs font-bold
                         text-kosc hover:bg-white/10
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
            >
              Pobierz CSV
            </a>
          </div>
          <p className="mt-1 px-1 text-xs leading-relaxed text-dym">
            Plik zawiera dane o zdrowiu i kontakty ICE. Nie wysyłaj go dalej i skasuj po
            przekazaniu ośrodkowi tego, czego potrzebuje (diety i alergie).
          </p>

          <ul className="mt-4 grid gap-3">
            {wynik.lista.map((u) => (
              <Karta key={u.id} u={u} />
            ))}
          </ul>
        </>
      )}

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}

function Karta({ u }: { u: Uczestnik }) {
  const dieta = u.wrazliwe?.dieta ?? u.dietaStara;
  const ice = opisIce(u.wrazliwe);
  const maWrazliwe = dieta || u.wrazliwe?.alergie || u.wrazliwe?.choroby_leki || ice;

  return (
    <li className="szklo rounded-md px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-sm font-bold text-kosc">
          {u.imie} {u.nazwisko}
          {u.ksywka && <span className="font-normal text-dym"> · {u.ksywka}</span>}
        </p>
        <p className="shrink-0 text-xs text-dym">{u.pula ? NAZWY_PUL[u.pula] : "sprzed tur"}</p>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-dym">Drużyna</dt>
        <dd className="text-kosc">{u.druzyna ?? "—"}</dd>
        <dt className="text-dym">Telefon</dt>
        <dd className="text-kosc">{u.telefon ?? "—"}</dd>
        {u.dojazd && (
          <>
            <dt className="text-dym">Dojazd</dt>
            <dd className="text-kosc">{etykietaDojazdu(u.dojazd)}</dd>
          </>
        )}
        {u.zwolnienie && (
          <>
            <dt className="text-dym">Zwolnienie 23.10</dt>
            <dd className="text-kosc">{u.zwolnienie}</dd>
          </>
        )}
        {u.alkohol && (
          <>
            <dt className="text-dym">Alkohol</dt>
            <dd className="text-kosc">{etykietaAlkoholu(u.alkohol)}</dd>
          </>
        )}
      </dl>

      {!u.zgodaWizerunek && (
        <p className="mt-2 inline-block rounded-sm border border-krew/50 px-2 py-1 text-xs font-bold text-krew-jasna">
          Bez zgody na wizerunek
        </p>
      )}

      {/* Dane z art. 9 pod przyciskiem — listę przegląda się też na telefonie. */}
      {maWrazliwe && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs text-dym">
            Dane wrażliwe (dieta, alergie, ICE)
          </summary>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {dieta && (
              <>
                <dt className="text-dym">Dieta</dt>
                <dd className="text-kosc">{dieta}</dd>
              </>
            )}
            {u.wrazliwe?.alergie && (
              <>
                <dt className="text-dym">Alergie</dt>
                <dd className="text-kosc">{u.wrazliwe.alergie}</dd>
              </>
            )}
            {u.wrazliwe?.choroby_leki && (
              <>
                <dt className="text-dym">Choroby, leki</dt>
                <dd className="text-kosc">{u.wrazliwe.choroby_leki}</dd>
              </>
            )}
            {ice && (
              <>
                <dt className="text-dym">ICE</dt>
                <dd className="text-kosc">{ice}</dd>
              </>
            )}
          </dl>
        </details>
      )}
    </li>
  );
}
