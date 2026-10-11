import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import type { Zawody } from "@/lib/zawody";

/** Lista zawodów: Toplakyyy, siatkówka, poker, szachy - i co z nich jest moje. */
export default async function ZawodyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: zawodyRaw, error }, { data: druzyny }, { data: zapisy }, { data: mojeSklady }] = await Promise.all([
    supabase.from("zawody").select("*").order("kolejnosc"),
    supabase.from("zawody_druzyny").select("zawody_id"),
    supabase.from("zawody_zapisy").select("zawody_id, user_id"),
    supabase.from("zawody_sklad").select("zawody_id, zawody_druzyny(nazwa)").eq("user_id", user.id),
  ]);

  if (error) {
    console.error("Nie udało się wczytać zawodów:", error);
    return (
      <Ekran tytul="Zawody" podtytul="Toplakyyy, siatkówka, poker, szachy">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-krew-jasna">
          Nie udało się wczytać zawodów. Odśwież za chwilę.
        </p>
      </Ekran>
    );
  }

  const zawody = (zawodyRaw ?? []) as Zawody[];
  const ileDruzyn = (zid: string) => (druzyny ?? []).filter((d) => d.zawody_id === zid).length;
  const ileZapisow = (zid: string) => (zapisy ?? []).filter((z) => z.zawody_id === zid).length;
  const mojSklad = new Map(
    ((mojeSklady ?? []) as unknown as { zawody_id: string; zawody_druzyny: { nazwa: string } | null }[]).map((s) => [
      s.zawody_id,
      s.zawody_druzyny?.nazwa ?? "skład",
    ]),
  );
  const zapisanyNa = new Set((zapisy ?? []).filter((z) => z.user_id === user.id).map((z) => z.zawody_id));

  return (
    <Ekran tytul="Zawody" podtytul="Toplakyyy, siatkówka, poker, szachy">
      <ul className="grid gap-3">
        {zawody.map((z) => {
          const moje = z.druzynowe
            ? mojSklad.has(z.id)
              ? `Grasz w składzie „${mojSklad.get(z.id)}”`
              : null
            : zapisanyNa.has(z.id)
              ? "Masz miejsce na liście"
              : null;
          return (
            <li key={z.id}>
              <Link href={`/app/zawody/${z.id}`} className="szklo block rounded-md px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-tytul text-xl leading-tight text-kosc">{z.nazwa}</h2>
                  <span
                    className={`shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.14em] ${
                      z.zapisy_otwarte ? "text-krew-jasna" : "text-dym"
                    }`}
                  >
                    {z.zapisy_otwarte ? "Zapisy trwają" : "Zapisy zamknięte"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-kosc/85">{z.opis}</p>
                <p className="mt-2 text-xs text-dym">
                  {z.druzynowe
                    ? `Składy po ${z.rozmiar_skladu} osób · zapisanych składów: ${ileDruzyn(z.id)}`
                    : `Indywidualnie · ${ileZapisow(z.id)}${z.limit_miejsc ? ` z ${z.limit_miejsc}` : ""} miejsc zajętych`}
                </p>
                {moje && <p className="mt-1 text-xs font-bold text-kosc">{moje}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </Ekran>
  );
}
