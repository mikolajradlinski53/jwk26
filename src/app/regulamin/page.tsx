import Link from "next/link";

// `description` nadpisany osobno — bez tego strona dziedziczyłaby po
// `layout.tsx` opis napisany z myślą o mrocznej apce ("Rytuał trwa."),
// a to jest publiczna, jasna strona regulaminu.
export const metadata = {
  title: "Regulamin — JWK26",
  description: "Zasady udziału w Jesiennym Wyjeździe Komisji 2026.",
};

export const viewport = {
  themeColor: "#fbf3e7",
};

/**
 * Regulamin wyjazdu. Trasa publiczna i osobna od landingu, żeby dało się ją
 * zlinkować wprost — komuś, kto zgłasza się na wyjazd, albo rodzicowi, który
 * pyta, na co dziecko się pisze.
 *
 * Treść napisana przez program, nie przez zarząd — stąd baner na górze.
 * Bez niego strona wyglądałaby na dokument o mocy prawnej, a nim nie jest.
 */
export default function RegulaminPage() {
  return (
    <main className="jesien mx-auto w-full max-w-2xl px-4 pb-16 pt-10">
      <Link href="/" className="text-sm text-jesien-rdza underline underline-offset-2">
        ← Wróć na start
      </Link>

      <h1 className="font-tytul mt-6 text-3xl leading-tight text-jesien-atrament">
        Regulamin JWK26
      </h1>

      <div className="mt-5 rounded-md border border-jesien-dynia/50 bg-jesien-dynia/10 p-4 text-sm leading-relaxed text-jesien-atrament">
        <strong className="text-jesien-rdza">Wersja robocza.</strong> Ten
        dokument czeka na zatwierdzenie przez zarząd Samorządu Studenckiego
        i dziś nie ma mocy obowiązującej — traktuj go jako zapowiedź
        ostatecznych zasad, nie gotowy regulamin.
      </div>

      <article className="mt-8 grid max-w-[65ch] gap-8 text-sm leading-relaxed text-jesien-kora">
        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">1. Kto może jechać</h2>
          <p className="mt-2">
            Na wyjazd jedzie kadra Komisji Samorządu Studenckiego oraz osoby
            przyjęte w procesie rekrutacji świeżaków. Udział jest dobrowolny
            i wymaga akceptacji zgłoszenia przez administratora.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">2. Zgłoszenia i wpłata</h2>
          <p className="mt-2">
            Zgłoszenie następuje przez aplikację i wymaga zatwierdzenia.
            Miejsce jest potwierdzone dopiero po wpłacie zaliczki w terminie
            podanym w komunikacie organizatorów — brak wpłaty w terminie
            oznacza utratę miejsca na rzecz osoby z listy rezerwowej.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">3. Zasady na miejscu</h2>
          <p className="mt-2">
            Alkohol tylko dla pełnoletnich i z umiarem — stan uniemożliwiający
            udział w programie może skutkować odesłaniem na koszt własny.
            Cisza nocna obowiązuje od godziny ustalonej na miejscu przez
            organizatorów. Każdy odpowiada za kulturalne zachowanie wobec
            innych uczestników i personelu ośrodka. Celowe niszczenie mienia
            ośrodka lub cudzej własności jest zabronione, a koszt naprawy
            ponosi osoba odpowiedzialna.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">4. Odpowiedzialność</h2>
          <p className="mt-2">
            Uczestnik odpowiada za własne bezpieczeństwo i mienie oraz za
            szkody, które wyrządzi. Organizatorzy nie ubezpieczają uczestników
            indywidualnie — zalecane jest posiadanie własnego ubezpieczenia
            NNW.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">5. Dane osobowe i zdjęcia</h2>
          <p className="mt-2">
            Dane podane w zgłoszeniu służą wyłącznie organizacji wyjazdu
            i nie są udostępniane podmiotom trzecim. Podczas wyjazdu mogą
            powstawać zdjęcia i filmy wykorzystywane do promocji kolejnych
            edycji — kto nie chce się na nich znaleźć, zgłasza to
            organizatorom przed rozpoczęciem wyjazdu.
          </p>
        </section>

        <section>
          <h2 className="font-tytul text-lg text-jesien-atrament">6. Postanowienia końcowe</h2>
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
