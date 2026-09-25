import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { DecyzjaZamowienia } from "./DecyzjaZamowienia";
import { StanPozycji } from "./StanPozycji";
import { IkonaPozycji } from "../../sklep/Ikona";
import type { ShopItem, WpisKroniki } from "@/types/db";

export default async function AdminSklepikPage() {
  const supabase = await createClient();

  const [{ data: kolejka }, { data: pozycje }] = await Promise.all([
    // Kolejka pokazuje wyłącznie 'pending', a pozycje cyfrowe nigdy nią nie są —
    // efekt wykonuje się w tej samej transakcji, co zakup. Filtr po statusie
    // wystarcza więc, żeby klątwy i tarcze nie zaśmiecały kolejki wydań.
    supabase
      .from("kronika_sklepiku")
      .select("*")
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("shop_items").select("*").order("position"),
  ]);

  const oczekujace = (kolejka ?? []) as WpisKroniki[];

  return (
    <Ekran tytul="Sklepik" podtytul="Kolejka wydań i stan półki">
      {oczekujace.length === 0 ? (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Nic nie czeka na wydanie.
        </p>
      ) : (
        <ol className="grid gap-2.5">
          {oczekujace.map((z) => (
            <li key={z.id} className="szklo rounded-md px-3.5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-bold">{z.item_name}</span>
                <span className="flex-none font-tytul text-sm tabular-nums text-dym">
                  {z.price_paid}
                </span>
              </div>
              <p className="mt-1 text-xs text-dym">
                <span style={{ color: z.team_color }}>{z.team_name}</span>
                {z.ordered_by_name && <> · zamówił {z.ordered_by_name}</>}
              </p>
              <DecyzjaZamowienia orderId={z.id} />
            </li>
          ))}
        </ol>
      )}

      <h2 className="mb-2.5 mt-8 px-1 text-xs uppercase tracking-[0.14em] text-dym">
        Półka
      </h2>
      <ul className="grid gap-2">
        {((pozycje ?? []) as ShopItem[]).map((p) => (
          <li key={p.id} className="szklo rounded-md px-3.5 py-3">
            <div className="flex items-center gap-3">
              <IkonaPozycji ikona={p.ikona} className="text-dym" />
              <span className="min-w-0 flex-1 text-sm font-bold">{p.name}</span>
              <span className="flex-none font-tytul text-sm tabular-nums text-dym">
                {p.price}
              </span>
            </div>
            <StanPozycji pozycja={p} />
          </li>
        ))}
      </ul>

      <p className="mt-5 px-1 text-xs leading-relaxed text-dym">
        Anulowanie zwraca punkty drużynie dodatnim wpisem w księdze i oddaje sztukę
        na półkę. Efektu cyfrowego nie da się cofnąć — klątwa już zabrała ofierze
        punkty.
      </p>

      <Link
        href="/app/admin"
        className="mt-7 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
      >
        Wróć do sanktuarium
      </Link>
    </Ekran>
  );
}
