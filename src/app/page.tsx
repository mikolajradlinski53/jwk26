import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { ustawienia, social } from "@/lib/ustawienia";
import { createClient } from "@/lib/supabase/server";
import { wczytajDanePrzelewu } from "@/lib/zapisy/przelewUstawienia";
import { DATY_WYJAZDU, miastoZAdresu, wczytajOdslony, widokOdslon } from "@/lib/odslony";
import type { PunktHarmonogramu } from "@/lib/harmonogram";
import { Naglowek } from "./landing/Naglowek";
import { Wejscie } from "./landing/Wejscie";
import { Opis } from "./landing/Opis";
import { Plan } from "./landing/Plan";
import { KiedyGdzie } from "./landing/KiedyGdzie";
import { Zapisy } from "./landing/Zapisy";
import { CenaIWplata } from "./landing/CenaIWplata";
import { Promocja } from "./landing/Promocja";
import { CoZabrac } from "./landing/CoZabrac";
import { Pytania } from "./landing/Pytania";
import { Dokumenty } from "./landing/Dokumenty";
import { Liscie } from "./landing/Liscie";
import { Przewodnik } from "./landing/zaba/Przewodnik";
import { Stopka } from "./landing/Stopka";
import { DzielnikFala, DzielnikSzewron, DzielnikSkos, DzielnikLisc } from "./landing/Dzielniki";

const TYTUL = "Jesienny Wyjazd Komisji 2026";

/**
 * Metadane liczone per żądanie: przed odsłoną ośrodka opis i podgląd linku
 * nie mogą podać miasta. Tytuł, opis i `appleWebApp` nadpisują domyślne
 * metadane z `layout.tsx` — te są napisane z myślą o mrocznej apce i landing
 * nie może ich zdradzić nawet w znaczniku, którego nikt nie czyta na oczy
 * (`appleWebApp.title` trzeba nadpisać osobno, bo Next scala metadane pole
 * po polu). Obrazek podglądu to plikowy `opengraph-image.jpg` obok.
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const [odslony, { miejsceAdres }] = await Promise.all([wczytajOdslony(supabase), ustawienia()]);
  const miasto = odslony.osrodek.odsloniete ? miastoZAdresu(miejsceAdres) : null;
  const opis = `${DATY_WYJAZDU}${miasto ? `, ${miasto}` : ""}. Wyjazd integracyjny Samorządu Studentów UEW — zapisz się.`;
  return {
    metadataBase: new URL("https://www.jwk26.pl"),
    title: TYTUL,
    description: opis,
    openGraph: { title: TYTUL, description: opis, type: "website", locale: "pl_PL" },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Jesienny Wyjazd Komisji" },
  };
}

// `themeColor` z layoutu jest ciemny (apka) — landing nadpisuje go jasnym
// odcieniem tła, żeby pasek przeglądarki na telefonie nie był czarny.
export const viewport: Viewport = {
  themeColor: "#fbf3e7",
  viewportFit: "cover",
};

/**
 * Landing wydarzenia. Publiczny, bez zamka instalacji — jedyna trasa, którą
 * ktoś ma otworzyć z Instagrama, zanim cokolwiek zainstaluje.
 *
 * Kolejność pod zapisy (spec landingu, wariant B). O zakrytych sekcjach
 * decyduje baza (`odslony()`), a polityki `app_settings` przed odsłoną nie
 * wydają miejsca ani danych przelewu — więc nie ma ich nawet czym wyrenderować.
 * Awaria odczytów nie wywraca strony: liczniki i dane po prostu się nie pokażą.
 */
export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Kod logowania, który wylądował na stronie głównej zamiast na /auth/callback.
  // Supabase robi tak, gdy adresu powrotu nie ma na liście Redirect URLs —
  // odsyła wtedy na Site URL. Bez tego przekazania sesja nigdy nie powstaje.
  const { code } = await searchParams;
  if (typeof code === "string" && code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const [{ dataJwk, dataSwiezakow, miejsceNazwa, miejsceAdres }, przelew, odslonySurowe, adresySocial, { data: planRaw }] =
    await Promise.all([
      ustawienia(),
      wczytajDanePrzelewu(supabase),
      wczytajOdslony(supabase),
      social(),
      // Jawnie tylko punkty na landing — zalogowany przyjęty widziałby inaczej
      // cały harmonogram (polityka dla zalogowanych nie filtruje po znaczniku).
      supabase
        .from("harmonogram")
        .select("id, dzien, godzina, tytul, opis")
        .eq("na_landingu", true)
        .order("dzien")
        .order("godzina", { nullsFirst: true }),
    ]);

  const odslony = widokOdslon(odslonySurowe, new Date());
  // Admin widzi w bazie wszystko — o tym, co pokazać, decyduje stan odsłony,
  // nie to, czy wartość przyszła z bazy.
  const osrodekJawny = odslony.osrodek.odsloniete;
  const cenaJawna = odslony.cena.odsloniete;
  const miasto = osrodekJawny ? miastoZAdresu(miejsceAdres) : null;
  const plan = (planRaw ?? []) as PunktHarmonogramu[];

  return (
    <div className="jesien relative">
      {/*
        Liście pod treścią, nad tłem: `Liscie` maluje na `fixed inset-0 z-0`,
        a opakowanie treści dostaje `relative z-10`. Sekcje mają tła na 70%
        krycia (`bg-jesien-tlo/70`, `bg-jesien-karta/70`), żeby liście
        prześwitywały — kontrast policzony dla najgorszego przypadku (~4,9:1).
      */}
      <Liscie />
      <Przewodnik />

      <div className="relative z-10">
        <Naglowek />
        <Wejscie dataJwk={dataJwk} zapisy={odslony.zapisy} miasto={miasto} />
        {/* Fala wypływa z ciemnego dołu zdjęcia hero w jasną sekcję. */}
        {/* Bez trasy: w hero żaba siedzi na liczniku, druga — wędrująca —
            obok niej wyglądałaby jak klon. Przewodnik rusza od następnego dzielnika. */}
        <DzielnikFala kolorKlasa="text-jesien-tlo" tloKlasa="bg-noc" trasa="brak" />

        <Opis kwota={cenaJawna ? (przelew?.kwota ?? null) : null} miasto={miasto} />
        {/* Trasa tuż przed zasłoniętą sekcją: żaba staje i wskazuje. */}
        <DzielnikSzewron trasa={plan.length === 0 && !osrodekJawny ? "wskazuj" : "idz"} />

        {plan.length > 0 && (
          <>
            <Plan punkty={plan} />
            <DzielnikSkos
              kolorKlasa="bg-jesien-tlo"
              tloKlasa="bg-jesien-karta"
              trasa={osrodekJawny ? "idz" : "wskazuj"}
            />
          </>
        )}

        <KiedyGdzie
          odslona={odslony.osrodek}
          nazwa={osrodekJawny ? miejsceNazwa : null}
          adres={osrodekJawny ? miejsceAdres : null}
        />
        <DzielnikSkos
          kolorKlasa="bg-jesien-karta"
          tloKlasa="bg-jesien-tlo"
          trasa={odslony.zapisy.odsloniete ? "idz" : "wskazuj"}
        />

        <Zapisy zapisy={odslony.zapisy} dataSwiezakow={dataSwiezakow} />
        <DzielnikSzewron trasa={cenaJawna ? "idz" : "wskazuj"} />

        <CenaIWplata odslona={odslony.cena} przelew={cenaJawna ? przelew : null} />
        <DzielnikFala kolorKlasa="text-jesien-karta" tloKlasa="bg-jesien-tlo" />

        <Promocja />
        <DzielnikLisc />

        <CoZabrac miasto={miasto} />
        <DzielnikSzewron />

        <Pytania />
        <DzielnikSzewron />

        <Dokumenty />

        <Stopka zapisy={odslony.zapisy} social={adresySocial} maPlan={plan.length > 0} />
      </div>
    </div>
  );
}
