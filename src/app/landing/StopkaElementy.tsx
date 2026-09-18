"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type Odnosnik = { etykieta: string; href: string };

export function OdnosnikNawigacji({ etykieta, href }: Odnosnik) {
  // Dotyk min. 44px dotyczy też odnośników nawigacji — stąd `min-h-11
  // flex items-center` na każdym linku, nawet kosztem gęstości listy.
  const klasa =
    "flex min-h-11 items-center text-[11.5px] text-jesien-kora transition duration-200 " +
    "hover:translate-x-[3px] hover:text-jesien-atrament " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza";

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={klasa}>
        {etykieta}
      </Link>
    );
  }

  return (
    <a href={href} className={klasa}>
      {etykieta}
    </a>
  );
}

export function KolumnaNawigacji({ tytul, odnosniki }: { tytul: string; odnosniki: Odnosnik[] }) {
  return (
    <div>
      <p className="mb-[21px] text-[12px] font-bold text-jesien-atrament">{tytul}</p>
      <ul className="grid gap-3.5">
        {odnosniki.map((o) => (
          <li key={o.etykieta}>
            <OdnosnikNawigacji {...o} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IkonaInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-full" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IkonaFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-full" aria-hidden="true">
      <path
        d="M14.5 8.2h2.3V5.1h-2.3c-2.3 0-4 1.8-4 4v1.7H8.6v3.1h1.9V21h3.1v-7.1h2.3l.6-3.1h-2.9V9.1c0-.5.4-.9.9-.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Trzy ukośne jasne kształty w znaku marki — nawiązanie do liścia/wstęgi. */
export function ZnakMarki() {
  return (
    <svg viewBox="0 0 25 25" fill="none" className="size-full" aria-hidden="true">
      <rect x="0" y="0" width="25" height="25" rx="7" fill="var(--color-jesien-atrament)" />
      <rect
        x="5"
        y="16"
        width="18"
        height="3.2"
        rx="1.6"
        transform="rotate(-32 5 16)"
        fill="var(--color-jesien-tlo)"
      />
      <rect
        x="8"
        y="20"
        width="14"
        height="2.6"
        rx="1.3"
        transform="rotate(-32 8 20)"
        fill="var(--color-jesien-tlo)"
        opacity="0.55"
      />
      <rect
        x="10.5"
        y="23"
        width="10"
        height="2.2"
        rx="1.1"
        transform="rotate(-32 10.5 23)"
        fill="var(--color-jesien-tlo)"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * Pływająca karta stopki z wjazdem przy wejściu w widok.
 *
 * Widoczność sterowana wyłącznie przez klasę na elemencie DOM (`ref`), nie
 * przez stan Reacta — nie ma tu nic, co potrzebowałoby przerenderowania,
 * a `react-hooks/set-state-in-effect` jest w repo twardym błędem. Dzięki
 * temu też nie ma rozjazdu SSR/klient: pierwszy render zawsze wygląda tak
 * samo, efekt dokleja klasę dopiero po hydracji.
 *
 * Przy `prefers-reduced-motion: reduce` karta ma być widoczna od razu —
 * observer w ogóle się nie uruchamia, klasa leci na sztywno.
 */
export function KartaStopki({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("jest-widoczna");
      return;
    }

    const obserwator = new IntersectionObserver(
      ([wpis]) => {
        if (wpis.isIntersecting) {
          el.classList.add("jest-widoczna");
          obserwator.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );
    obserwator.observe(el);

    return () => obserwator.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="stopka-karta relative z-10 mx-auto w-[calc(100%-24px)] rounded-[23px]
                 p-[32px_24px]
                 min-[600px]:w-[calc(100%-38px)] min-[600px]:rounded-[25px]
                 min-[600px]:p-[38px_32px_34px]
                 min-[850px]:w-[calc(100%-96px)] min-[850px]:max-w-[1000px]
                 min-[850px]:rounded-[30px] min-[850px]:p-[48px_49px_43px]"
    >
      {children}
    </div>
  );
}
