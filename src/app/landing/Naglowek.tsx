import Link from "next/link";

/**
 * Nagłówek landingu. Przyklejony do góry przez cały zjazd strony w dół —
 * część wchodzących zna już wydarzenie i szuka wyłącznie drogi do środka,
 * więc przycisk wejścia towarzyszy im niezależnie od tego, gdzie akurat są,
 * zamiast czekać, aż ktoś przewinie do wezwania ukrytego w treści.
 *
 * Padding górny liczony osobno od `body`: `position: sticky` mierzy „top: 0"
 * względem widocznego okna, nie względem paddingu `body`, więc przyklejony
 * nagłówek wjechałby pod wcięcie ekranu, mimo że reszta strony ma już
 * odstęp z `env(safe-area-inset-top)`.
 */
export function Naglowek() {
  return (
    <header
      className="szklo sticky top-0 z-20 flex items-center justify-between gap-3
                 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]"
    >
      <Link href="/" className="min-w-0 truncate font-tytul text-lg font-bold text-kosc">
        JWK26
      </Link>

      <Link
        href="/wejscie"
        className="flex min-h-11 shrink-0 items-center rounded-full border border-white/20
                   bg-gradient-to-b from-krew/90 to-krew-glab/90 px-4 text-sm font-bold text-white
                   shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_26px_rgb(200_16_46/0.32)]
                   backdrop-blur-md transition hover:brightness-110
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
      >
        Wejdź
      </Link>
    </header>
  );
}
