import type { ReactNode } from "react";

/**
 * Kształty pozycji półki, rysowane w miejscu — tak samo jak ikony paska
 * nawigacji. Jedenaście konturów nie uzasadnia kolejnej zależności, a te muszą
 * być czytelne przy 24 px, w ciemności, po alkoholu.
 *
 * Wszystkie są konturowe (`fill: none`, `stroke: currentColor`), więc dziedziczą
 * kolor po rodzicu i wyglądają jednorodnie obok tekstu. Klucze przychodzą
 * z kolumny `shop_items.ikona`.
 */
const KSZTALTY: Record<string, ReactNode> = {
  // Butelka wódki — korek, szyjka, etykieta.
  butelka: (
    <>
      <path d="M10 4h4v3.2l2 3.1V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9.7l2-3.1Z" />
      <path d="M8 14.5h8" />
      <path d="M10.5 4V2.5h3V4" />
    </>
  ),

  // Kielich na wino: czasza, trzon, stopka.
  wino: (
    <>
      <path d="M7.5 3.5h9v3.2a4.5 4.5 0 0 1-9 0Z" />
      <path d="M12 11.2V20" />
      <path d="M8.5 20.5h7" />
    </>
  ),

  // Kufel z uchem — jedyny kształt, który czyta się jako „piwo" bez podpisu.
  kufel: (
    <>
      <path d="M6 7.5h9.5V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
      <path d="M15.5 10.5h2a2.2 2.2 0 0 1 0 4.5h-2" />
      <path d="M6 11h9.5" />
    </>
  ),

  // Skrzynka z wystającymi szyjkami — kilka butelek naraz.
  skrzynka: (
    <>
      <path d="M4.5 10h15v9a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2Z" />
      <path d="M7 10V6.5h1.8V10M11.1 10V6.5h1.8V10M15.2 10V6.5H17V10" />
      <path d="M4.5 14.5h15" />
    </>
  ),

  // Kropla — namaszczenie. Jeden kontur, więc czytelny nawet bardzo mały.
  kropla: <path d="M12 3.2s5.5 6.6 5.5 10.1a5.5 5.5 0 0 1-11 0C6.5 9.8 12 3.2 12 3.2Z" />,

  // Torebka z zawiniętą górą.
  worek: (
    <>
      <path d="M7 7.5h10l-1 12.1a1.5 1.5 0 0 1-1.5 1.4h-5A1.5 1.5 0 0 1 8 19.6Z" />
      <path d="M7 7.5 8.6 3.5h6.8L17 7.5" />
      <path d="M9.5 11.5h5" />
    </>
  ),

  // Puszka z wieczkiem i przewężeniem.
  puszka: (
    <>
      <path d="M7.5 6h9v13a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z" />
      <path d="M9 6V3.6h6V6" />
      <path d="M7.5 10h9" />
    </>
  ),

  // Kawałek pizzy: trójkąt ze łukiem spodu i trzema dodatkami.
  pizza: (
    <>
      <path d="M12 3.2 20.5 19a26 26 0 0 1-17 0Z" />
      <circle cx="10.5" cy="11.5" r="1" />
      <circle cx="14" cy="13.5" r="1" />
      <circle cx="11.8" cy="16" r="1" />
    </>
  ),

  // Blask — błogosławieństwo.
  blask: (
    <>
      <circle cx="12" cy="12" r="3.4" />
      <path
        d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6
           M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"
      />
    </>
  ),

  tarcza: <path d="M12 2.8 20 5.6v6.2c0 4.4-3.2 7.6-8 9.4-4.8-1.8-8-5-8-9.4V5.6Z" />,

  // Sztylet ostrzem w dół. Czaszka byłaby memiarska, a ma być poważnie.
  sztylet: (
    <>
      <path d="M12 21.5 9.6 8.5h4.8Z" />
      <path d="M7 8.5h10" />
      <path d="M12 8.5v-6" />
      <path d="M10.5 2.5h3" />
    </>
  ),

  // Neutralny znak dla pozycji bez ikony albo z kluczem, którego tu nie ma.
  znak: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
};

export function IkonaPozycji({
  ikona,
  className = "",
}: {
  ikona: string | null;
  className?: string;
}) {
  const ksztalt = (ikona ? KSZTALTY[ikona] : undefined) ?? KSZTALTY.znak;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={"size-6 flex-none " + className}
    >
      {ksztalt}
    </svg>
  );
}
