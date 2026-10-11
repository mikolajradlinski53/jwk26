import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import type { DruzynaZawodow, Mecz, Zawody } from "@/lib/zawody";
import { NoweZawody, PanelZawodow } from "./PanelZawodow";

/** Zawody: okienko zapisów, składy, terminarz i wyniki. */
export default async function ZawodyAdminPage() {
  const supabase = await createClient();
  const [{ data: zawody, error }, { data: druzyny }, { data: sklad }, { data: zapisy }, { data: mecze }, { data: gracze }] =
    await Promise.all([
      supabase.from("zawody").select("*").order("kolejnosc"),
      supabase.from("zawody_druzyny").select("*").order("created_at"),
      supabase.from("zawody_sklad").select("druzyna_id, user_id"),
      supabase.from("zawody_zapisy").select("zawody_id, user_id, created_at").order("created_at"),
      supabase.from("zawody_mecze").select("*").order("runda"),
      supabase.rpc("zawody_gracze"),
    ]);

  if (error) {
    console.error("Nie udało się wczytać zawodów (admin):", error);
    return (
      <Ekran tytul="Zawody" podtytul="Zapisy, składy, terminarz">
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">Nie udało się wczytać zawodów. Odśwież stronę.</p>
        <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
      </Ekran>
    );
  }

  const nazwa = new Map(((gracze ?? []) as { id: string; nazwa: string }[]).map((g) => [g.id, g.nazwa]));
  const skl = (sklad ?? []) as { druzyna_id: string; user_id: string }[];

  return (
    <Ekran tytul="Zawody" podtytul="Zapisy, składy, terminarz">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        {((zawody ?? []) as Zawody[]).map((z) => (
          <PanelZawodow
            key={z.id}
            zawody={z}
            druzyny={((druzyny ?? []) as DruzynaZawodow[])
              .filter((d) => d.zawody_id === z.id)
              .map((d) => ({
                ...d,
                ludzie: skl.filter((s) => s.druzyna_id === d.id).map((s) => nazwa.get(s.user_id) ?? "Ktoś"),
              }))}
            zapisani={((zapisy ?? []) as { zawody_id: string; user_id: string }[])
              .filter((s) => s.zawody_id === z.id)
              .map((s) => ({ id: s.user_id, nazwa: nazwa.get(s.user_id) ?? "Ktoś" }))}
            mecze={((mecze ?? []) as Mecz[]).filter((m) => m.zawody_id === z.id)}
          />
        ))}
        <NoweZawody />
      </div>
      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
