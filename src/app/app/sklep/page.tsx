import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import type { LicytacjaWidok } from "@/lib/licytacje";
import type { Team, TeamScore, UserScore } from "@/types/db";
import { KartaLicytacji } from "./KartaLicytacji";
import { LicytacjeNaZywo } from "./LicytacjeNaZywo";

/** Sekcje ekranu w chwili żądania (strona renderuje się na serwerze przy każdym wejściu). */
function podziel(lista: LicytacjaWidok[]) {
  const teraz = Date.now();
  return {
    trwaja: lista.filter((l) => l.status === "trwa" && Date.parse(l.start) <= teraz),
    wkrotce: lista.filter((l) => l.status === "trwa" && Date.parse(l.start) > teraz),
    zakonczone: lista.filter((l) => l.status === "zamknieta").reverse(),
  };
}

/**
 * Licytacje (2026-10-22) - zastępują sklepik. Admin wystawia przedmiot,
 * kapitanowie drużyn przebijają się punktami drużyny, licytacja zamyka się
 * sama o godzinie admina (cron co minutę). Reguły pilnuje baza.
 */
export default async function LicytacjePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const { data: profil } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).maybeSingle();
  const mojaDruzyna = (profil?.team_id as string | null) ?? null;

  const [{ data: listaRaw, error: bladListy }, { data: druzynyRaw }, { data: krokRaw }] = await Promise.all([
    supabase.rpc("licytacje_lista"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("app_settings").select("value").eq("key", "licytacja_krok").maybeSingle(),
  ]);

  const lista = (listaRaw ?? []) as LicytacjaWidok[];
  const druzyny = (druzynyRaw ?? []) as Team[];
  const krok = Number(krokRaw?.value) || 10;
  const moja = druzyny.find((d) => d.id === mojaDruzyna) ?? null;
  // Kadra (drużyna ukryta) nie licytuje - widzi licytacje jak podgląd.
  const licytujaca = moja && !moja.ukryta ? moja : null;
  const jestKapitanem = licytujaca?.captain_id === user.id;

  const [{ data: wynik }, { data: wolne }, { data: ludzie }, { data: klatwyRaw }] = licytujaca
    ? await Promise.all([
        supabase.from("team_scores").select("*").eq("team_id", licytujaca.id).maybeSingle(),
        supabase.rpc("dostepne_saldo", { p_team: licytujaca.id }),
        supabase.from("user_scores").select("user_id, display_name").eq("team_id", licytujaca.id),
        // Wygrane Klątwy czekające na ofiarę - przycisk „Rzuć klątwę” na karcie.
        supabase
          .from("shop_orders")
          .select("id")
          .eq("team_id", licytujaca.id)
          .eq("status", "pending")
          .is("target_team_id", null),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }];

  const saldo = (wynik as TeamScore | null)?.score ?? 0;
  const nazwaKapitana =
    ((ludzie ?? []) as Pick<UserScore, "user_id" | "display_name">[]).find((o) => o.user_id === licytujaca?.captain_id)
      ?.display_name ?? null;
  const klatwyDoRzucenia = new Set(((klatwyRaw ?? []) as { id: string }[]).map((k) => k.id));
  const { trwaja, wkrotce, zakonczone } = podziel(lista);
  const naKlatwe = druzyny.filter((d) => !d.ukryta && d.id !== licytujaca?.id);

  const karta = (l: LicytacjaWidok) => (
    <KartaLicytacji
      key={l.id}
      licytacja={l}
      krok={krok}
      mojaDruzyna={licytujaca?.id ?? null}
      jestKapitanem={jestKapitanem}
      klatwaDoRzucenia={l.order_id !== null && klatwyDoRzucenia.has(l.order_id)}
      druzynyNaKlatwe={naKlatwe}
    />
  );

  return (
    <Ekran tytul="Licytacje" podtytul={licytujaca?.name ?? (profil?.role === "admin" ? "Podgląd Organizatora" : undefined)}>
      <LicytacjeNaZywo />
      {licytujaca ? (
        <div className="szklo mb-4 grid grid-cols-2 gap-3 rounded-md px-4 py-4">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-dym">Saldo drużyny</p>
            <strong className="font-tytul text-2xl leading-none tabular-nums">{saldo}</strong>
          </div>
          <div className="text-right">
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-dym">Wolne do licytowania</p>
            <strong className="font-tytul text-2xl leading-none tabular-nums text-krew-jasna">
              {typeof wolne === "number" ? wolne : saldo}
            </strong>
          </div>
          <p className="col-span-2 text-xs leading-relaxed text-dym">
            {jestKapitanem
              ? "Licytujesz w imieniu drużyny. Prowadząca oferta trzyma punkty, aż ktoś Was przebije."
              : `Licytuje kapitan${nazwaKapitana ? `: ${nazwaKapitana}` : ""}. Punkty schodzą dopiero po wygranej.`}
          </p>
        </div>
      ) : (
        <p className="szklo mb-4 rounded-md px-4 py-3 text-xs leading-relaxed text-dym">
          {profil?.role === "admin"
            ? "Podgląd Organizatora - licytacje wystawiasz w panelu (Licytacje)."
            : "Nie masz jeszcze drużyny. Licytuje kapitan drużyny."}
        </p>
      )}

      {bladListy && (
        <p className="szklo mb-4 rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać licytacji. Odśwież za chwilę.
        </p>
      )}

      <NaglowekSekcji>Trwają</NaglowekSekcji>
      {trwaja.length === 0 ? (
        <p className="szklo rounded-md px-4 py-5 text-center text-sm text-dym">Teraz nic nie jest licytowane.</p>
      ) : (
        <div className="grid gap-4">{trwaja.map(karta)}</div>
      )}

      {wkrotce.length > 0 && (
        <>
          <NaglowekSekcji>Wkrótce</NaglowekSekcji>
          <div className="grid gap-4">{wkrotce.map(karta)}</div>
        </>
      )}

      {zakonczone.length > 0 && (
        <>
          <NaglowekSekcji>Zakończone</NaglowekSekcji>
          <div className="grid gap-4">{zakonczone.map(karta)}</div>
        </>
      )}

      <div className="mt-5">
        <OdswiezPrzyPowrocie />
      </div>
    </Ekran>
  );
}
