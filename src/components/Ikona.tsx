/**
 * Ikony interfejsu w stylu Instagrama: obrys 3,2 w siatce 48 × 48, kółko 2,6,
 * zaokrąglone końce, kolor z `currentColor`. Rysowane ręcznie, nie
 * generowane — ostre w każdym rozmiarze i lżejsze od obrazka (spec wyglądu,
 * D1, D7). Kształty zatwierdzone na makiecie `ikony-svg`.
 */
const KSZTALTY = {
  oko: (
    <>
      <path d="M8 24c4.5-7 9.8-10.5 16-10.5S35.5 17 40 24c-4.5 7-9.8 10.5-16 10.5S12.5 31 8 24Z" />
      <circle cx="24" cy="24" r="4.2" fill="currentColor" stroke="none" />
    </>
  ),
  kielich: (
    <>
      <path d="M16 13h16v3.5a8 8 0 0 1-16 0Z" />
      <path d="M24 24.5V33" />
      <path d="M18.5 35h11" />
    </>
  ),
  list: (
    <>
      <rect x="11" y="15" width="26" height="18" rx="3.5" />
      <path d="m12 16.5 12 9 12-9" />
      <circle cx="24" cy="25.5" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  pioro: (
    <>
      <path d="M33.5 13.5C23 14 16 21 15 34.5c10-1.5 17-9 18.5-21Z" />
      <path d="M15 34.5 26 22" />
    </>
  ),
  swieca: (
    <>
      <rect x="19.5" y="21" width="9" height="14" rx="2" />
      <path d="M24 21v-2.5" />
      <path d="M24 18.5c2-1.6 2-3.8 0-5.8-2 2-2 4.2 0 5.8Z" fill="currentColor" />
    </>
  ),
  karty: (
    <>
      <rect x="13" y="16" width="14" height="19" rx="2.5" />
      <path d="M22.5 13h10a2.5 2.5 0 0 1 2.5 2.5v14" />
    </>
  ),

  // Pozycje Sanktuarium.
  zwoj: (
    <>
      <rect x="14" y="12" width="20" height="24" rx="3" />
      <path d="M19 19h10M19 24h10M19 29h6" />
    </>
  ),
  osoby: (
    <>
      <circle cx="20" cy="19" r="4.5" />
      <path d="M12 34c1-5 4.3-7.5 8-7.5s7 2.5 8 7.5" />
      <path d="M29 15.5a4.5 4.5 0 0 1 0 8.5M31 26.8c2.4.9 4.3 3.2 5 7.2" />
    </>
  ),
  dzwonek: (
    <>
      <path d="M17 30v-8a7 7 0 0 1 14 0v8l2.5 3h-19Z" />
      <path d="M21.5 36.5a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  gwiazda: <path d="m24 12.5 3.4 7 7.6 1.1-5.5 5.4 1.3 7.6L24 30l-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1Z" />,
  plansza: (
    <>
      <rect x="13" y="13" width="22" height="22" rx="3" />
      <path d="M13 20.3h22M13 27.7h22M20.3 13v22M27.7 13v22" />
    </>
  ),
  torba: (
    <>
      <path d="M15 19h18l-1.4 14.2a2.5 2.5 0 0 1-2.5 2.3H18.9a2.5 2.5 0 0 1-2.5-2.3Z" />
      <path d="M20 19v-2a4 4 0 0 1 8 0v2" />
    </>
  ),
  plus: <path d="M24 15v18M15 24h18" />,
  tarcza: <path d="M24 12.5 34 16v8c0 6-4.2 10.2-10 12-5.8-1.8-10-6-10-12v-8Z" />,
  zegar: (
    <>
      <circle cx="24" cy="24" r="9.5" />
      <path d="M24 18.5V24l3.5 2.5" />
    </>
  ),
  zebatka: (
    <>
      <circle cx="24" cy="24" r="4" />
      <path d="M24 13v3.5M24 31.5V35M13 24h3.5M31.5 24H35M16.2 16.2l2.5 2.5M29.3 29.3l2.5 2.5M16.2 31.8l2.5-2.5M29.3 18.7l2.5-2.5" />
    </>
  ),
} as const;

export type NazwaIkony = keyof typeof KSZTALTY;

export function Ikona({ nazwa, className = "size-11" }: { nazwa: NazwaIkony; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="24" cy="24" r="21.7" strokeWidth="2.6" />
      {KSZTALTY[nazwa]}
    </svg>
  );
}
