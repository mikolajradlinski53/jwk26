/**
 * Partnerzy wyjazdu, pasek tuż pod hero - widoczny bez przewijania, nie
 * konkuruje z „Zapisz się” w hero. Logotypy z plików od Mikołaja, czarne na
 * przezroczystym tle (Kolejkowo i Pizza Genuina w swoich kolorach - znak
 * pizzerii wycięty z grafiki reklamowej). Eveline Cosmetics (2026-10-13) na
 * górze; pozostali (2026-10-22) pod nim w siatce 2×2. Adresy od Mikołaja.
 * `sponsored` - link partnerski, nie rekomendacja redakcyjna.
 */
const POZOSTALI = [
  { nazwa: "Rent4 Events", klucz: "rent4events", url: "https://rent4event.pl/", plik: "/logo/rent4events.webp", szer: 560, wys: 284 },
  { nazwa: "Wędlinka", klucz: "wedlinka", url: "https://wedlinka.com/", plik: "/logo/wedlinka.webp", szer: 560, wys: 305 },
  { nazwa: "Kolejkowo", klucz: "kolejkowo", url: "https://kolejkowo.pl/wroclaw/", plik: "/logo/kolejkowo.webp", szer: 560, wys: 186 },
  { nazwa: "Pizza Genuina", klucz: "pizza-genuina", url: "https://genuina.pizza/#start", plik: "/logo/pizza-genuina.webp", szer: 560, wys: 366 },
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
        {/* Równe pola, logo wpasowane w środek: proporcje znaków są bardzo
            różne (Kolejkowo 3:1, Pizza Genuina 3:2), więc wspólna wysokość. */}
        <ul className="grid w-full grid-cols-2 items-center gap-x-6 gap-y-5">
          {POZOSTALI.map((p) => (
            <li key={p.nazwa} className="flex h-16 items-center justify-center">
              <a
                href={p.url}
                target="_blank"
                rel="noopener sponsored"
                data-zdarzenie="partner"
                data-miejsce={p.klucz}
                aria-label={`${p.nazwa} - strona partnera (nowa karta)`}
                className="flex h-full items-center rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jesien-rdza"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public, bez optymalizacji */}
                <img src={p.plik} alt={p.nazwa} width={p.szer} height={p.wys} className="max-h-full w-auto max-w-[min(38vw,150px)] object-contain" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
