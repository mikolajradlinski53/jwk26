import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Polka } from "./Polka";
import { Kronika } from "./Kronika";
import type {
  ActiveEffect,
  ShopItem,
  Team,
  TeamScore,
  UserScore,
  WpisKroniki,
} from "@/types/db";

const NAZWA_EFEKTU: Record<string, string> = {
  blogoslawienstwo: "Błogosławieństwo",
  tarcza: "Tarcza",
};

export default async function SklepPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .maybeSingle();

  const mojaDruzyna = profil?.team_id as string | null;

  if (!mojaDruzyna) {
    return (
      <Ekran tytul="Sklepik" podtytul="Zakupy z salda drużyny">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Nie masz jeszcze drużyny. Kapłan przypisze ją przy zgłoszeniu.
        </p>
      </Ekran>
    );
  }

  const [
    { data: druzyny },
    { data: wynik },
    { data: moiLudzie },
    { data: pozycje },
    { data: efekty },
    { data: kronika },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_scores").select("*").eq("team_id", mojaDruzyna).maybeSingle(),
    supabase.from("user_scores").select("*").eq("team_id", mojaDruzyna),
    supabase.from("shop_items").select("*").eq("active", true).order("position"),
    // Widok `czynne_efekty` odsiewa zużyte i przedawnione po stronie bazy —
    // patrz komentarz w migracji 20260925120400.
    supabase.from("czynne_efekty").select("*").eq("subject_id", mojaDruzyna),
    supabase
      .from("kronika_sklepiku")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const wszystkie = (druzyny ?? []) as Team[];
  const moja = wszystkie.find((d) => d.id === mojaDruzyna);
  const saldo = (wynik as TeamScore | null)?.score ?? 0;
  const jestKapitanem = moja?.captain_id === user.id;

  // Nazwę kapitana bierzemy z już pobranej listy członków drużyny, zamiast
  // dopytywać o nią osobnym zapytaniem po `captain_id`. Jedna podróż mniej,
  // a lista i tak musi być pobrana.
  const nazwaKapitana =
    ((moiLudzie ?? []) as UserScore[]).find((o) => o.user_id === moja?.captain_id)
      ?.display_name ?? null;

  const czynne = (efekty ?? []) as ActiveEffect[];

  return (
    <Ekran tytul="Sklepik" podtytul={moja?.name}>
      <div className="szklo mb-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">Saldo drużyny</span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">{saldo}</strong>
      </div>

      {czynne.length > 0 && (
        <ul className="mb-4 grid gap-1.5">
          {czynne.map((e) => (
            <li
              key={e.id}
              className="szklo rounded-md px-3.5 py-2.5 text-xs text-krew-jasna"
            >
              {NAZWA_EFEKTU[e.effect_key] ?? e.effect_key} — czynne
            </li>
          ))}
        </ul>
      )}

      <Polka
        pozycje={(pozycje ?? []) as ShopItem[]}
        saldo={saldo}
        jestKapitanem={jestKapitanem}
        nazwaKapitana={nazwaKapitana}
        obceDruzyny={wszystkie.filter((d) => d.id !== mojaDruzyna)}
      />

      <h2 className="mb-2.5 mt-8 px-1 text-xs uppercase tracking-[0.14em] text-dym">
        Kronika
      </h2>
      <Kronika wpisy={(kronika ?? []) as WpisKroniki[]} />
    </Ekran>
  );
}
