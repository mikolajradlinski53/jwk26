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
