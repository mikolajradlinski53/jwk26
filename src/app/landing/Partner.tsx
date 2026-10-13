/**
 * Partner wyjazdu (2026-10-13): Eveline Cosmetics, pasek tuż pod hero -
 * widoczny bez przewijania, nie konkuruje z „Zapisz się” w hero. Logo
 * przycięte z pliku od Mikołaja (czarne, przezroczyste tło), link do polskiej
 * strony marki. `sponsored` - link partnerski, nie rekomendacja redakcyjna.
 */
export function Partner() {
  return (
    <section aria-label="Partner wyjazdu" className="bg-jesien-tlo px-4 pb-8 pt-2">
      <div className="mx-auto grid max-w-md justify-items-center gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">Partner wyjazdu</p>
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
      </div>
    </section>
  );
}
