"use client";

import { useRef } from "react";

/**
 * Zdjęcie we wpisie feedu: podgląd (720 px), a pełne dopiero po dotknięciu -
 * w dialogu na cały ekran (spec porządku, D6). Pełne ładuje się dopiero przy
 * otwarciu, więc przewijanie feedu ciągnie wyłącznie podglądy.
 */
export function ZdjecieFeedu({ url, opis }: { url: string; opis: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Powiększ: ${opis}`}
        className="block w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-krew"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- trasa apki z własnym nagłówkiem cache */}
        <img
          src={`${url}?podglad`}
          alt={opis}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full object-cover"
        />
      </button>

      {/* `open:flex`, nie `flex` - klasa autora biłaby regułę przeglądarki
          chowającą zamknięty dialog (ten sam błąd był w bingo). */}
      <dialog
        ref={dialogRef}
        aria-label={opis}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none items-center justify-center
                   border-0 bg-noc/90 p-3 backdrop-blur-sm open:flex"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- trasa apki z własnym nagłówkiem cache */}
        <img
          src={url}
          alt={opis}
          decoding="async"
          loading="lazy"
          className="max-h-full max-w-full rounded-md object-contain"
        />
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Zamknij"
          className="szklo-plynne absolute right-4 top-[calc(1rem+env(safe-area-inset-top,0px))] grid size-11 place-items-center rounded-full"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-5">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </dialog>
    </>
  );
}
