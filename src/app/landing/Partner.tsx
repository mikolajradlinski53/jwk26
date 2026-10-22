/**
 * Partnerzy wyjazdu, pasek tuż pod hero - widoczny bez przewijania, nie
 * konkuruje z „Zapisz się” w hero. Logotypy z plików od Mikołaja, czarne na
 * przezroczystym tle. Eveline Cosmetics (2026-10-13) na górze i z linkiem do
 * polskiej strony marki; Rent4 Events i Wędlinka (2026-10-22) pod nim, na
 * razie bez linków - adresów nie dostaliśmy. `sponsored` - link partnerski,
 * nie rekomendacja redakcyjna.
 */
const POZOSTALI = [
  { nazwa: "Rent4 Events", plik: "/logo/rent4events.webp", szer: 560, wys: 284 },
  { nazwa: "Wędlinka", plik: "/logo/wedlinka.webp", szer: 560, wys: 305 },
];

export function Partner() {
  return (
    <section aria-label="Partnerzy wyjazdu" className="bg-jesien-tlo px-4 pb-8 pt-2">
      <div className="mx-auto grid max-w-md justify-items-center gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Partnerzy wyjazdu</p>
        <a
          href="https://eveline.pl/"
          target="_blank"
          rel="noopener sponsored"
          data-zdarzenie="partner"
          data-miejsce="eveline"
          aria-label="Eveline Cosmetics - strona partnera (nowa karta)"
          className="rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jesien-rdza"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public, bez optymalizacji */}
          <img src="/logo/eveline.webp" alt="Eveline Cosmetics" width={560} height={145} className="h-auto w-[min(72vw,280px)]" />
        </a>
        <ul className="flex items-center justify-center gap-8">
          {POZOSTALI.map((p) => (
            <li key={p.nazwa}>
              {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public, bez optymalizacji */}
              <img src={p.plik} alt={p.nazwa} width={p.szer} height={p.wys} className="h-auto w-[min(32vw,130px)]" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
