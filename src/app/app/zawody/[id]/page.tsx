import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import { tabela, type DruzynaZawodow, type Mecz, type Zawody } from "@/lib/zawody";
import { ZapisSkladu, MojSklad, ZapisIndywidualny } from "./Akcje";

export default async function ZawodyDetal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const { data: zRaw } = await supabase.from("zawody").select("*").eq("id", id).maybeSingle();
  if (!zRaw) notFound();
  const z = zRaw as Zawody;

  const [{ data: druzynyRaw }, { data: skladRaw }, { data: zapisyRaw }, { data: meczeRaw }, { data: graczeRaw }] =
    await Promise.all([
      supabase.from("zawody_druzyny").select("*").eq("zawody_id", id).order("created_at"),
      supabase.from("zawody_sklad").select("druzyna_id, user_id").eq("zawody_id", id),
      supabase.from("zawody_zapisy").select("user_id, created_at").eq("zawody_id", id).order("created_at"),
      supabase.from("zawody_mecze").select("*").eq("zawody_id", id).order("runda"),
      supabase.rpc("zawody_gracze"),
    ]);

  const druzyny = (druzynyRaw ?? []) as DruzynaZawodow[];
  const sklad = (skladRaw ?? []) as { druzyna_id: string; user_id: string }[];
  const mecze = (meczeRaw ?? []) as Mecz[];
  const gracze = (graczeRaw ?? []) as { id: string; nazwa: string }[];
  const nazwa = new Map(gracze.map((g) => [g.id, g.nazwa]));
  const nazwaDruzyny = new Map(druzyny.map((d) => [d.id, d.nazwa]));
  const czlonkowie = (did: string) => sklad.filter((s) => s.druzyna_id === did).map((s) => s.user_id);

  const mojaDruzyna = druzyny.find((d) => czlonkowie(d.id).includes(user.id));
  const wSkladach = new Map(sklad.map((s) => [s.user_id, nazwaDruzyny.get(s.druzyna_id) ?? ""]));
  const zapisani = (zapisyRaw ?? []) as { user_id: string }[];
  const rundy = [...new Set(mecze.map((m) => m.runda))].sort((a, b) => a - b);

  return (
    <Ekran tytul={z.nazwa} podtytul={z.druzynowe ? `Składy po ${z.rozmiar_skladu} osób` : "Zapisy indywidualne"}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        {z.opis && <p className="text-sm leading-relaxed text-kosc/85">{z.opis}</p>}
        <p className={`text-[0.62rem] font-bold uppercase tracking-[0.14em] ${z.zapisy_otwarte ? "text-krew-jasna" : "text-dym"}`}>
          {z.zapisy_otwarte ? "Zapisy trwają" : "Zapisy zamknięte"}
        </p>

        {z.druzynowe && mojaDruzyna && (
          <MojSklad
            zawodyId={z.id}
            druzyna={{ id: mojaDruzyna.id, nazwa: mojaDruzyna.nazwa }}
            czlonkowie={czlonkowie(mojaDruzyna.id).map((u) => ({ id: u, nazwa: nazwa.get(u) ?? "Ktoś" }))}
            rozmiar={z.rozmiar_skladu ?? 0}
            jestemZalozycielem={mojaDruzyna.zalozyciel_id === user.id}
            zapisyOtwarte={z.zapisy_otwarte}
            wolni={gracze.filter((g) => !wSkladach.has(g.id))}
          />
        )}

        {z.druzynowe && !mojaDruzyna && z.zapisy_otwarte && (
          <ZapisSkladu
            zawodyId={z.id}
            rozmiar={z.rozmiar_skladu ?? 0}
            wymagaDziewczyny={z.wymaga_dziewczyny}
            gracze={gracze
              .filter((g) => g.id !== user.id)
              .map((g) => ({ ...g, sklad: wSkladach.get(g.id) ?? null }))}
          />
        )}

        {!z.druzynowe && (
          <ZapisIndywidualny
            zawodyId={z.id}
            zapisany={zapisani.some((s) => s.user_id === user.id)}
            zajete={zapisani.length}
            limit={z.limit_miejsc}
            zapisyOtwarte={z.zapisy_otwarte}
          />
        )}

        {z.druzynowe && rundy.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-sm font-bold">Tabela</h2>
            <div className="szklo overflow-x-auto rounded-md">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-[0.6rem] uppercase tracking-[0.12em] text-dym">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Skład</th>
                    <th className="px-1 py-2 font-bold" title="Mecze">M</th>
                    <th className="px-1 py-2 font-bold" title="Wygrane-remisy-porażki">W-R-P</th>
                    <th className="px-1 py-2 font-bold" title="Punkty zdobyte:stracone">+/-</th>
                    <th className="px-3 py-2 text-right font-bold">Pkt</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela(druzyny, mecze).map((w, i) => (
                    <tr key={w.druzynaId} className={w.druzynaId === mojaDruzyna?.id ? "text-krew-jasna" : "text-kosc"}>
                      <td className="px-3 py-1.5">
                        {i + 1}. {w.nazwa}
                      </td>
                      <td className="px-1 py-1.5 text-center">{w.mecze}</td>
                      <td className="px-1 py-1.5 text-center">
                        {w.wygrane}-{w.remisy}-{w.porazki}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        {w.zdobyte}:{w.stracone}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold">{w.punkty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-2 text-sm font-bold">Terminarz</h2>
            {rundy.map((r) => (
              <div key={r} className="szklo rounded-md px-4 py-3">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">Runda {r}</p>
                <ul className="mt-1 grid gap-1">
                  {mecze
                    .filter((m) => m.runda === r)
                    .map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm text-kosc">
                        <span className="min-w-0 flex-1 truncate">{nazwaDruzyny.get(m.druzyna_a)}</span>
                        <span className="shrink-0 font-bold tabular-nums">
                          {m.wynik_a === null ? "-" : `${m.wynik_a} : ${m.wynik_b}`}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right">{nazwaDruzyny.get(m.druzyna_b)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {z.druzynowe && (
          <section className="grid gap-3">
            <h2 className="text-sm font-bold">Składy ({druzyny.length})</h2>
            {druzyny.length === 0 && <p className="text-sm text-dym">Jeszcze żaden skład się nie zapisał.</p>}
            {druzyny.map((d) => {
              const ludzie = czlonkowie(d.id);
              return (
                <div key={d.id} className="szklo rounded-md px-4 py-3">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-tytul text-lg text-kosc">{d.nazwa}</span>
                    <span className="text-xs text-dym tabular-nums">
                      {ludzie.length}/{z.rozmiar_skladu}
                      {ludzie.length < (z.rozmiar_skladu ?? 0) ? " · niepełny" : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-kosc/85">{ludzie.map((u) => nazwa.get(u) ?? "Ktoś").join(", ")}</p>
                </div>
              );
            })}
          </section>
        )}

        {!z.druzynowe && (
          <section className="grid gap-2">
            <h2 className="text-sm font-bold">Zapisani ({zapisani.length})</h2>
            {zapisani.length === 0 ? (
              <p className="text-sm text-dym">Jeszcze nikt.</p>
            ) : (
              <ol className="szklo list-inside list-decimal rounded-md px-4 py-3 text-sm text-kosc">
                {zapisani.map((s) => (
                  <li key={s.user_id}>{nazwa.get(s.user_id) ?? "Ktoś"}</li>
                ))}
              </ol>
            )}
          </section>
        )}

        <OdswiezPrzyPowrocie />
        <Wroc href="/app/zawody">Wszystkie zawody</Wroc>
      </div>
    </Ekran>
  );
}
