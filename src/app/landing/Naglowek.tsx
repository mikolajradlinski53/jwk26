import Image from "next/image";
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
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b
                 border-jesien-kora/15 bg-jesien-tlo/90 px-4 pb-3
                 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-md"
    >
      <Link href="/" className="flex min-w-0 shrink-0 items-center">
        <Image
          src="/logo/logo-kolor.png"
          alt="Jesienny Wyjazd Komisji"
          width={1600}
          height={597}
          className="h-7 w-auto min-[600px]:h-8"
        />
      </Link>

      <Link
        href="/wejscie"
        className="flex min-h-11 shrink-0 items-center rounded-full border border-jesien-rdza/40
                   bg-jesien-rdza px-4 text-sm font-bold text-white
                   transition hover:brightness-110
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
      >
        Wejdź
      </Link>
    </header>
  );
}
