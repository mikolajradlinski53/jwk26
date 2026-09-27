import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OSWIADCZENIE_SZKODY, WERSJA_ZGOD } from "@/lib/zapisy/zgody";

// `description` nadpisany osobno — bez tego strona dziedziczyłaby po
// `layout.tsx` opis napisany z myślą o mrocznej apce.
export const metadata = {
  title: "Regulamin — JWK26",
  description: "Zasady udziału w Jesiennym Wyjeździe Komisji 2026.",
};

export const viewport = {
  themeColor: "#fbf3e7",
};

/**
 * Regulamin wyjazdu. Trasa publiczna i osobna od landingu, żeby dało się ją
 * zlinkować wprost — z formularza zapisów albo komuś, kto pyta, na co się pisze.
 *
 * Baner „wersja robocza" zależy od `regulamin_zatwierdzony` w app_settings
 * (D8 speca zapisów). Anonim czyta tę flagę dzięki polityce settings_read_public.
 * Błąd odczytu zostawia baner: lepiej pokazać ostrzeżenie za dużo niż
 * udawać moc obowiązującą, której nie ma.
 */
export default async function RegulaminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "regulamin_zatwierdzony")
    .maybeSingle();
  const zatwierdzony = data?.value === true;

  return (
    <main className="jesien mx-auto w-full max-w-2xl px-4 pb-16 pt-10">
      <Link href="/" className="text-sm text-jesien-rdza underline underline-offset-2">
        ← Wróć na start
      </Link>

      <h1 className="font-tytul mt-6 text-3xl leading-tight text-jesien-atrament">
        Regulamin JWK26
      </h1>
      <p className="mt-1 text-xs text-jesien-kora">Wersja z {WERSJA_ZGOD}</p>

      {!zatwierdzony && (
        <div className="mt-5 rounded-md border border-jesien-dynia/50 bg-jesien-dynia/10 p-4 text-sm leading-relaxed text-jesien-atrament">
          <strong className="text-jesien-rdza">Wersja robocza.</strong> Ten
          dokument czeka na zatwierdzenie przez zarząd Samorządu Studenckiego
          i dziś nie ma mocy obowiązującej — traktuj go jako zapowiedź
          ostatecznych zasad, nie gotowy regulamin.
        </div>
      )}

      <article className="mt-8 grid max-w-[65ch] gap-8 text-sm leading-relaxed text-jesien-kora">
        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">1. Kto może jechać</h2>
          <p className="mt-2">
            Na wyjazd jadą Działacze Samorządu Studenckiego, Świeżaki przyjęci
            w procesie rekrutacji oraz Alumni. Uczestnik musi mieć ukończone
            18 lat w dniu wyjazdu. Udział jest dobrowolny i wymaga akceptacji
            zgłoszenia przez organizatora.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">2. Zapisy i wpłata</h2>
          <p className="mt-2">
            Zapisy odbywają się przez aplikację w trzech turach otwieranych
            kolejno: dla Działaczy, Świeżaków i Alumnów. Każda tura ma ustaloną
            liczbę miejsc. Po jej zapełnieniu można zapisać się na listę
            rezerwową bez wpłaty; gdy zwolni się miejsce, organizator przesuwa
            na listę kolejną osobę z rezerwy i prosi ją o wpłatę. Miejsce jest
            potwierdzone po wpłacie w terminie podanym przez organizatorów
            i akceptacji zgłoszenia.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">3. Zasady na miejscu</h2>
          <p className="mt-2">
            Alkohol tylko z umiarem — stan uniemożliwiający udział w programie
            może skutkować odesłaniem na koszt własny. Cisza nocna obowiązuje od
            godziny ustalonej na miejscu przez organizatorów. Każdy odpowiada za
            kulturalne zachowanie wobec innych uczestników i personelu ośrodka.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">4. Szkody</h2>
          <p className="mt-2">
            Celowe niszczenie mienia ośrodka lub cudzej własności jest
            zabronione. Każdy uczestnik akceptuje w formularzu zapisów
            następujące oświadczenie:
          </p>
          <p className="mt-2 border-l-2 border-jesien-dynia/50 pl-3">{OSWIADCZENIE_SZKODY}</p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">5. Odpowiedzialność</h2>
          <p className="mt-2">
            Uczestnik odpowiada za własne bezpieczeństwo i mienie. Organizatorzy
            nie ubezpieczają uczestników indywidualnie — zalecane jest
            posiadanie własnego ubezpieczenia NNW.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">6. Dane osobowe i wizerunek</h2>
          <p className="mt-2">
            Zasady przetwarzania danych opisuje klauzula informacyjna
            w formularzu zapisów. Podczas wyjazdu powstają zdjęcia i filmy.
            Wizerunek uczestnika rozpowszechniamy wyłącznie za zgodą wyrażoną
            w formularzu; zgodę można w każdej chwili wycofać w aplikacji.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">7. Postanowienia końcowe</h2>
          <p className="mt-2">
            Regulamin obowiązuje od zatwierdzenia przez zarząd Samorządu do
            zakończenia wyjazdu. Organizatorzy zastrzegają sobie prawo do
            zmiany programu z przyczyn niezależnych od nich. W sprawach tu
            nieujętych decyduje zarząd Samorządu.
          </p>
        </section>
      </article>

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-jesien-rdza underline underline-offset-2"
      >
        ← Wróć na start
      </Link>
    </main>
  );
}
