import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Button } from "@/components/ui/Button";
import { TwojeZgody } from "@/components/TwojeZgody";
import { stanZgod } from "@/lib/zapisy/stanZgod";
import { Formularz } from "./Formularz";
import { DolaczPrzelew } from "./DolaczPrzelew";
import type { Registration, StanPuli } from "@/types/db";

// Zapasowa data wyjazdu, gdyby ustawienie zniknęło. Walidacja w przeglądarce
// jest wygodą; o pełnoletności i tak rozstrzyga zloz_zgloszenie() z bazy.
const DATA_JWK_ZAPASOWA = "2026-10-23T18:00:00+02:00";

export default async function RejestracjaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bramka w proxy.ts nie wpuści tu niezalogowanego, ale token może wygasnąć
  // między jej sprawdzeniem a tym renderem.
  if (!user) redirect("/wejscie");

  const [{ data }, { data: pule }, { data: ustawienie }, { data: flaga }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("stan_pul"),
    supabase.from("app_settings").select("value").eq("key", "data_jwk").maybeSingle(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "regulamin_zatwierdzony")
      .maybeSingle(),
  ]);

  const ostatnie = data as Registration | null;
  // Przy roboczym regulaminie zloz_zgloszenie odbija zapis nawet w otwartej
  // turze (D8). Pokazanie jej jako otwartej wpuściłoby człowieka w siedem
  // kroków zakończonych „tura zamknięta", bez wyjścia.
  const regulaminOk = flaga?.value === true;
  const stan = ((pule ?? []) as StanPuli[]).map((p) => ({
    ...p,
    otwarta: p.otwarta && regulaminOk,
  }));

  if (ostatnie?.status === "pending") {
    const zgody = await stanZgod(supabase, ostatnie);
    const nazwaPuli = stan.find((p) => p.klucz === ostatnie.pula)?.nazwa;

    if (ostatnie.rezerwa) {
      const { data: pozycja } = await supabase.rpc("pozycja_w_rezerwie");
      return (
        <Ekran tytul="Rezerwa" podtytul={nazwaPuli}>
          <div className="szklo rounded-md px-4 py-6 text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-dym">Miejsce w kolejce</p>
            <p className="mt-1 font-tytul text-4xl tabular-nums">{pozycja ?? "—"}</p>
            <p className="mt-3 text-sm leading-relaxed text-dym">
              Gdy zwolni się miejsce, organizator przesunie Cię na listę. Wtedy
              zobaczysz tu prośbę o potwierdzenie przelewu.
            </p>
          </div>
          <TwojeZgody {...zgody} />
          <Wyloguj />
        </Ekran>
      );
    }

    if (!ostatnie.proof_path) {
      return (
        <Ekran tytul="Miejsce czeka" podtytul={nazwaPuli}>
          <p className="szklo mb-5 rounded-md px-4 py-4 text-sm leading-relaxed text-dym">
            Zwolniło się miejsce i organizator przesunął Cię z rezerwy. Zrób przelew
            za wyjazd i wgraj jego potwierdzenie — dopiero wtedy zgłoszenie trafi
            do akceptacji.
          </p>
          <DolaczPrzelew />
          <TwojeZgody {...zgody} />
          <Wyloguj />
        </Ekran>
      );
    }

    return (
      <Ekran tytul="Próba" podtytul="Czekaj na wyrok Kapłana">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm leading-relaxed text-dym">
          Twoja ofiara została złożona.
        </p>
        <TwojeZgody {...zgody} />
        <Wyloguj />
      </Ekran>
    );
  }

  const otwarte = stan.some((p) => p.otwarta);

  return (
    <Ekran tytul={ostatnie ? "Ponowna próba" : "Próba"}>
      {ostatnie?.status === "rejected" && (
        <div className="szklo mb-5 rounded-md border-krew/50 px-4 py-3.5">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-krew-jasna">
            Odrzucono
          </p>
          <p className="mt-1 text-sm text-dym">{ostatnie.review_note ?? "Bez podania powodu."}</p>
        </div>
      )}

      {otwarte ? (
        <Formularz
          pule={stan}
          dataJwk={(ustawienie?.value as string | undefined) ?? DATA_JWK_ZAPASOWA}
        />
      ) : (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm leading-relaxed text-dym">
          Zapisy jeszcze się nie zaczęły albo wszystkie tury są zamknięte. Zajrzyj
          tu, gdy organizator ogłosi otwarcie.
        </p>
      )}
      <Wyloguj />
    </Ekran>
  );
}

function Wyloguj() {
  return (
    <form action="/auth/signout" method="post" className="mt-10">
      <Button variant="cichy" type="submit" className="w-full">
        Wyloguj
      </Button>
    </form>
  );
}
