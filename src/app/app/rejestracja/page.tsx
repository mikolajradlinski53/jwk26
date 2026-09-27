import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Button } from "@/components/ui/Button";
import { TwojeZgody } from "@/components/TwojeZgody";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import { stanZgod, type StanZgod } from "@/lib/zapisy/stanZgod";
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

  const [
    { data, error: bladZgloszenia },
    { data: pule, error: bladPul },
    { data: ustawienie },
    { data: flaga, error: bladFlagi },
  ] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("stan_pul"),
    // Ustawienie samo w sobie jest tylko wygodą (patrz DATA_JWK_ZAPASOWA
    // niżej) — jego błąd nie zasługuje na cały ekran błędu.
    supabase.from("app_settings").select("value").eq("key", "data_jwk").maybeSingle(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "regulamin_zatwierdzony")
      .maybeSingle(),
  ]);

  // Brak zgłoszenia (`data === null`) znaczy po prostu „nowa osoba" — ale
  // błąd odczytu wygląda identycznie jak `null`, więc bez tego rozróżnienia
  // ktoś zobaczyłby czysty formularz zamiast informacji, że coś nie zadziałało.
  if (bladZgloszenia || bladPul || bladFlagi) {
    console.error("Poczekalnia: odczyt danych startowych nie przeszedł:", {
      zgloszenie: bladZgloszenia && { code: bladZgloszenia.code, message: bladZgloszenia.message },
      pule: bladPul && { code: bladPul.code, message: bladPul.message },
      regulamin: bladFlagi && { code: bladFlagi.code, message: bladFlagi.message },
    });
    return (
      <Ekran tytul="Próba">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm leading-relaxed text-dym">
          Nie udało się wczytać Twojego zgłoszenia. Sprawdź połączenie i spróbuj
          ponownie.
        </p>
        <OdswiezPrzyPowrocie />
        <Wyloguj />
      </Ekran>
    );
  }

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
    const nazwaPuli = stan.find((p) => p.klucz === ostatnie.pula)?.nazwa;

    if (ostatnie.rezerwa) {
      // Dwa niezależne zapytania dla tego samego ekranu — równolegle, żeby
      // czekać na wolniejsze z nich, a nie na sumę obu.
      const [zgody, { data: pozycja }] = await Promise.all([
        stanZgod(supabase, user.id, ostatnie),
        supabase.rpc("pozycja_w_rezerwie"),
      ]);
      return (
        <Ekran tytul="Rezerwa" podtytul={nazwaPuli}>
          <div className="szklo rounded-md px-4 py-6 text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-dym">Miejsce w kolejce</p>
            <p className="mt-1 font-tytul text-4xl tabular-nums">{pozycja ?? "—"}</p>
            <p className="mt-3 text-sm leading-relaxed text-dym">
              {ostatnie.proof_path
                ? "Twoje potwierdzenie przelewu już mamy. Gdy zwolni się miejsce i " +
                  "organizator przesunie Cię na listę, zgłoszenie od razu trafi do akceptacji."
                : "Gdy zwolni się miejsce, organizator przesunie Cię na listę. Wtedy " +
                  "zobaczysz tu prośbę o potwierdzenie przelewu."}
            </p>
          </div>
          <TwojeZgody {...zgody} />
          {/* Awans z rezerwy jest ruchem admina, nie czymś, co ta osoba wywoła
              sama — bez odświeżania po powrocie zostałaby tu, nieświadoma,
              że kolejka już ruszyła dalej. */}
          <OdswiezPrzyPowrocie />
          <Wyloguj />
        </Ekran>
      );
    }

    const zgody = await stanZgod(supabase, user.id, ostatnie);

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
        {/* Akceptację albo odrzucenie ustawia admin — bez odświeżania po
            powrocie ta osoba czekałaby na wyrok, który już zapadł. */}
        <OdswiezPrzyPowrocie />
        <Wyloguj />
      </Ekran>
    );
  }

  const otwarte = stan.some((p) => p.otwarta);
  // Odrzucone zgłoszenie mogło zostawić dane zdrowotne albo aktywne zgody —
  // brama wpuszcza taką osobę wyłącznie tu, więc to jedyne miejsce, gdzie
  // może je wycofać.
  const zgodyOstatnie: StanZgod | null = ostatnie
    ? await stanZgod(supabase, user.id, ostatnie)
    : null;

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
      {zgodyOstatnie && <TwojeZgody {...zgodyOstatnie} />}
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
