"use client";

import { useRef, useState } from "react";

/**
 * Zdjęcie albo film we wpisie feedu: podgląd (720 px; dla filmu okładka),
 * a pełne dopiero po dotknięciu - w dialogu na cały ekran (spec porządku, D6).
 * Pełne ładuje się dopiero przy otwarciu, więc przewijanie feedu ciągnie
 * wyłącznie podglądy. Film (2026-10-23) startuje dopiero w dialogu.
 */
export function ZdjecieFeedu({ url, opis, film = false }: { url: string; opis: string; film?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const [otwarty, setOtwarty] = useState(false);
  // Okładka filmu bywa niedostępna (przeglądarka nie oddała klatki przy wysyłce).
  const [bezOkladki, setBezOkladki] = useState(false);

  function otworz() {
    dialogRef.current?.showModal();
    setOtwarty(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={otworz}
        aria-label={`${film ? "Odtwórz" : "Powiększ"}: ${opis}`}
        className="relative block w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-krew"
      >
        {film && bezOkladki ? (
          <span className="block aspect-square w-full bg-noc-glab" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- trasa apki z własnym nagłówkiem cache
          <img
            src={`${url}?podglad`}
            alt={opis}
            loading="lazy"
            decoding="async"
            onError={film ? () => setBezOkladki(true) : undefined}
            className="aspect-square w-full object-cover"
          />
        )}
        {film && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-noc/60 text-white shadow-[0_2px_12px_rgb(0_0_0/0.5)] backdrop-blur-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-1 size-7">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
          </span>
        )}
      </button>

      {/* `open:flex`, nie `flex` - klasa autora biłaby regułę przeglądarki
          chowającą zamknięty dialog (ten sam błąd był w bingo). */}
      <dialog
        ref={dialogRef}
        aria-label={opis}
        onClose={() => {
          filmRef.current?.pause();
          setOtwarty(false);
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none items-center justify-center
                   border-0 bg-noc/90 p-3 backdrop-blur-sm open:flex"
      >
        {film ? (
          // Źródło dopiero po otwarciu - zamknięty dialog nie ciągnie filmu.
          otwarty && (
            <video
              ref={filmRef}
              src={url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="max-h-full max-w-full rounded-md"
            />
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- trasa apki z własnym nagłówkiem cache
          <img
            src={url}
            alt={opis}
            decoding="async"
            loading="lazy"
            className="max-h-full max-w-full rounded-md object-contain"
          />
        )}
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
