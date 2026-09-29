import Link from "next/link";
import { LicznikOdslony } from "./LicznikOdslony";
import type { OdslonaWidok } from "@/lib/odslony";

const STYLE = {
  // Na zdjęciu hero - biały tekst nad przyciemnieniem.
  hero: {
    przycisk:
      "flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full border border-jesien-rdza/40 " +
      "bg-jesien-rdza px-5 text-sm font-bold text-white shadow-[0_14px_30px_-12px_rgb(12_7_9/0.6)] transition " +
      "hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
    podpis: "text-sm text-white drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)]",
  },
  // Jasna sekcja landingu.
  sekcja: {
    przycisk:
      "flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full bg-jesien-rdza px-5 text-sm " +
      "font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 " +
      "focus-visible:outline-jesien-rdza",
    podpis: "text-sm text-jesien-atrament",
  },
  // Panel wezwania w stopce - biały prostokąt na gradiencie.
  panel: {
    przycisk:
      "flex h-[42px] min-w-[120px] items-center justify-center rounded-sm bg-white px-6 text-[12px] font-semibold " +
      "text-jesien-atrament focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
    podpis: "text-[13px] text-white",
  },
} as const;

/**
 * „Zapisz się” po odsłonie zapisów; przedtem licznik nad wyszarzonym
 * przyciskiem, który nigdzie nie prowadzi. „Wejdź” w nagłówku jest do tej
 * samej chwili wyłączone (Naglowek.tsx).
 */
export function PrzyciskZapisu({ odslona, wariant }: { odslona: OdslonaWidok; wariant: keyof typeof STYLE }) {
  const s = STYLE[wariant];
  if (odslona.odsloniete) {
    return (
      <Link href="/wejscie" className={s.przycisk}>
        Zapisz się
      </Link>
    );
  }
  return (
    <div className="grid justify-items-center gap-2">
      <p className={s.podpis}>
        <span aria-hidden="true">Zapisy ruszają za </span>
        <LicznikOdslony data={odslona.data} poczatkowy={odslona.poczatkowy} className="font-bold" />
        <span className="sr-only">Zapisy ruszają {odslona.kiedy}.</span>
      </p>
      <span aria-disabled="true" className={`${s.przycisk} cursor-not-allowed opacity-45`}>
        Zapisz się
      </span>
    </div>
  );
}
