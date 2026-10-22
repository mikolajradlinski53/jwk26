import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import type { LicytacjaWidok } from "@/lib/licytacje";
import type { ShopItem, Team, WpisKroniki } from "@/types/db";
import { DecyzjaZamowienia } from "./DecyzjaZamowienia";
import { NowaLicytacja } from "./NowaLicytacja";
import { ObslugaLicytacji } from "./ObslugaLicytacji";
import { KlatwaZaKapitana } from "./KlatwaZaKapitana";

const GODZINA = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", hour: "2-digit", minute: "2-digit" });

type KlatwaCzekajaca = { id: string; team_id: string; teams: { name: string } | null };

/**
 * Panel licytacji (2026-10-22, zastępuje panel sklepiku): wystawianie,
 * obsługa trwających, Klątwy czekające na ofiarę i kolejka wydań nagród.
 */
export default async function AdminLicytacjePage() {
  const supabase = await createClient();

  const [{ data: kolejka }, { data: katalog }, { data: lista }, { data: druzyny }, { data: klatwyRaw }] =
    await Promise.all([
      // Kolejka wydań: tylko nagrody fizyczne. Cyfrowe `pending` to wyłącznie
      // Klątwy czekające na ofiarę - mają własną sekcję.
      supabase.from("kronika_sklepiku").select("*").eq("status", "pending").eq("item_kind", "physical").order("created_at"),
      supabase.from("shop_items").select("*").eq("active", true).order("position").order("name"),
      supabase.rpc("licytacje_lista"),
      supabase.from("teams").select("*").eq("ukryta", false).order("name"),
      supabase
        .from("shop_orders")
        .select("id, team_id, teams!shop_orders_team_id_fkey(name), shop_items!inner(effect_key)")
        .eq("status", "pending")
        .is("target_team_id", null)
        .eq("shop_items.effect_key", "klatwa"),
    ]);

  const oczekujace = (kolejka ?? []) as WpisKroniki[];
  const licytacje = ((lista ?? []) as LicytacjaWidok[]).filter((l) => l.status === "trwa");
  const jawne = (druzyny ?? []) as Team[];
  const klatwy = (klatwyRaw ?? []) as unknown as KlatwaCzekajaca[];

  return (
    <Ekran tytul="Licytacje" podtytul="Wystawianie, przebieg i wydania">
      <NaglowekSekcji>Nowa licytacja</NaglowekSekcji>
      <NowaLicytacja katalog={(katalog ?? []) as ShopItem[]} />

      <NaglowekSekcji>Trwające i zapowiedziane</NaglowekSekcji>
      {licytacje.length === 0 ? (
        <p className="szklo rounded-md px-4 py-5 text-center text-sm text-dym">Nic nie jest wystawione.</p>
      ) : (
        <ol className="grid gap-2.5">
          {licytacje.map((l) => (
            <li key={l.id} className="szklo rounded-md px-3.5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-bold">
                  {l.nazwa}
                  {l.w_ciemno && <span className="ml-2 text-xs font-normal text-dym">(w ciemno)</span>}
                </span>
                <span className="flex-none font-tytul text-sm tabular-nums text-krew-jasna">
                  {l.najwyzsza ?? l.cena_wywolawcza} pkt
                </span>
              </div>
              <p className="mt-1 text-xs text-dym">
                {l.prowadzi_nazwa ? `Prowadzi ${l.prowadzi_nazwa} · ofert: ${l.liczba_ofert}` : "Bez ofert"} · od{" "}
                {GODZINA.format(new Date(l.start))} do {GODZINA.format(new Date(l.koniec))}
              </p>
              <ObslugaLicytacji id={l.id} nazwa={l.nazwa ?? "Licytacja"} />
            </li>
          ))}
        </ol>
      )}

      {klatwy.length > 0 && (
        <>
          <NaglowekSekcji>Klątwy czekające na ofiarę</NaglowekSekcji>
          <ol className="grid gap-2.5">
            {klatwy.map((k) => (
              <li key={k.id} className="szklo rounded-md px-3.5 py-3.5">
                <p className="text-sm font-bold">Klątwa - wygrała {k.teams?.name ?? "drużyna"}</p>
                <p className="mt-1 text-xs text-dym">Kapitan jeszcze nie wybrał ofiary.</p>
                <KlatwaZaKapitana orderId={k.id} druzyny={jawne.filter((d) => d.id !== k.team_id)} />
              </li>
            ))}
          </ol>
        </>
      )}

      <NaglowekSekcji>Kolejka wydań</NaglowekSekcji>
      {oczekujace.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">Nic nie czeka na wydanie.</p>
      ) : (
        <ol className="grid gap-2.5">
          {oczekujace.map((z) => (
            <li key={z.id} className="szklo rounded-md px-3.5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-bold">{z.item_name}</span>
                <span className="flex-none font-tytul text-sm tabular-nums text-dym">{z.price_paid}</span>
              </div>
              <p className="mt-1 text-xs text-dym">
                <span style={{ color: z.team_color }}>{z.team_name}</span>
                {z.ordered_by_name && <> · licytował(a) {z.ordered_by_name}</>}
              </p>
              <DecyzjaZamowienia orderId={z.id} />
            </li>
          ))}
        </ol>
      )}

      <p className="mt-5 px-1 text-xs leading-relaxed text-dym">
        Licytacje zamykają się same w ciągu minuty po godzinie zamknięcia. Anulowanie zamówienia z kolejki
        zwraca drużynie punkty wpisem w księdze.
      </p>

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
