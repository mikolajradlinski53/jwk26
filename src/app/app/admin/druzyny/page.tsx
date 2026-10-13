import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { WyborKapitana } from "./WyborKapitana";
import { StartGlosowania, AkcjeDruzyny } from "./Glosowanie";
import { Przydzial, type OsobaDoPrzydzialu } from "./Przydzial";
import { NAZWY_PUL } from "@/lib/zapisy/formularz";
import type { Team, TeamScore, UserScore } from "@/types/db";
import { Wroc } from "@/components/Wroc";

export default async function AdminDruzynyPage() {
  const supabase = await createClient();

  const [
    { data: druzyny },
    { data: wyniki },
    { data: osoby },
    { data: postepy },
    { data: przyjeci },
    { data: zgloszenia },
    { data: limitRaw },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("numer", { nullsFirst: false }),
    supabase.from("team_scores").select("*"),
    supabase.from("user_scores").select("*").order("display_name"),
    supabase.rpc("postep_glosowania"),
    supabase.from("profiles").select("id, display_name, email, role, team_id").eq("status", "approved"),
    supabase.from("registrations").select("user_id, imie, nazwisko, pula").eq("status", "approved"),
    supabase.from("app_settings").select("value").eq("key", "druzyna_limit").maybeSingle(),
  ]);

  // Imię i nazwisko ze zgłoszenia - ksywka nie zawsze mówi, kto to.
  const zgl = new Map(
    ((zgloszenia ?? []) as { user_id: string; imie: string | null; nazwisko: string | null; pula: string | null }[]).map(
      (z) => [z.user_id, z],
    ),
  );
  const doPrzydzialu: OsobaDoPrzydzialu[] = (
    (przyjeci ?? []) as { id: string; display_name: string | null; email: string; role: string; team_id: string | null }[]
  ).map((p) => {
    const z = zgl.get(p.id);
    const imie = [z?.imie, z?.nazwisko].filter(Boolean).join(" ");
    return {
      id: p.id,
      nazwa: imie || p.display_name || p.email,
      podpis: [p.display_name, z?.pula ? NAZWY_PUL[z.pula as keyof typeof NAZWY_PUL] : null].filter(Boolean).join(" · "),
      kadra: p.role === "admin",
      teamId: p.team_id,
    };
  });

  const salda = new Map(
    ((wyniki ?? []) as TeamScore[]).map((w) => [w.team_id, w.score]),
  );
  const czlonkowie = (osoby ?? []) as UserScore[];
  const postep = new Map(
    (postepy as { team_id: string; glosow: number; czlonkow: number }[] | null ?? []).map(
      (p) => [p.team_id, { glosow: p.glosow, czlonkow: p.czlonkow }],
    ),
  );
  const zespoly = (druzyny ?? []) as Team[];

  return (
    <Ekran tytul="Drużyny" podtytul="Kapitan kupuje z salda drużyny">
      {zespoly.every((d) => d.glosowanie === "nie_rozpoczete") && <StartGlosowania />}
      <Przydzial osoby={doPrzydzialu} druzyny={zespoly} limit={Number(limitRaw?.value) || 9} />
      <h2 className="mb-2 mt-8 text-sm font-bold">Kapitanowie i salda</h2>
      <ul className="grid gap-2.5">
        {zespoly.map((d) => (
          <li key={d.id} className="szklo rounded-md px-3.5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-bold" style={{ color: d.color }}>
                {d.name}
              </span>
              <span className="flex-none font-tytul text-lg leading-none tabular-nums">
                {salda.get(d.id) ?? 0}
              </span>
            </div>
            <WyborKapitana
              teamId={d.id}
              kapitanId={d.captain_id}
              czlonkowie={czlonkowie.filter((c) => c.team_id === d.id)}
            />
            <AkcjeDruzyny
              team={d}
              glosow={postep.get(d.id)?.glosow ?? 0}
              czlonkow={postep.get(d.id)?.czlonkow ?? 0}
            />
          </li>
        ))}
      </ul>

      <p className="mt-5 px-1 text-xs leading-relaxed text-dym">
        Bez kapitana drużyna nic nie kupi. Zmiana działa od razu - poprzedni traci
        prawo zakupu, historia zostaje.
      </p>

      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
