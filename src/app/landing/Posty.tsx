"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { POSTY, type Post } from "./aktualnosciDane";

/** Pierwsza niepusta linia opisu - zajawka pod kafelkiem. */
function zajawka(tresc: string): string {
  return tresc.split("\n").find((l) => l.trim()) ?? "";
}

/**
 * Kafelki postów z tej edycji. Kliknięcie otwiera okno z pełnym opisem
 * (i grafiką albo odtwarzaczem). Escape i tło zamykają, focus wraca na
 * kafelek - tak samo jak w galerii wspomnień.
 */
export function Posty() {
  const [otwarty, setOtwarty] = useState<Post | null>(null);
  const kafelki = useRef<Record<string, HTMLButtonElement | null>>({});
  const zamknijRef = useRef<HTMLButtonElement>(null);

  function zamknij() {
    const id = otwarty?.id;
    setOtwarty(null);
    if (id) kafelki.current[id]?.focus();
  }

  useEffect(() => {
    if (!otwarty) return;
    zamknijRef.current?.focus();
    function naKlawisz(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOtwarty(null);
      }
    }
    // Tło strony stoi w miejscu, przewija się tylko okno z opisem.
    const poprzedni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", naKlawisz);
    return () => {
      window.removeEventListener("keydown", naKlawisz);
      document.body.style.overflow = poprzedni;
    };
  }, [otwarty]);

  return (
    <>
      <div className="grid gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-3">
        {POSTY.map((p) => (
          <button
            key={p.id}
            type="button"
            ref={(el) => {
              kafelki.current[p.id] = el;
            }}
            onClick={() => setOtwarty(p)}
            className="group grid content-start overflow-hidden rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 text-left
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
          >
            <span className="relative block aspect-square w-full overflow-hidden bg-jesien-kora/10">
              <Image
                src={p.grafika ?? p.wideo?.plakat ?? ""}
                alt=""
                fill
                sizes="(min-width: 1000px) 320px, (min-width: 600px) 45vw, 92vw"
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
              />
              {p.wideo && (
                <span className="absolute inset-0 grid place-items-center bg-jesien-atrament/25">
                  <span className="grid size-16 place-items-center rounded-full bg-jesien-tlo/95 text-jesien-rdza shadow-lg">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-1 size-7">
                      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
                    </svg>
                  </span>
                </span>
              )}
            </span>
            <span className="grid gap-1 p-4">
              <span className="font-tytul text-lg leading-tight text-jesien-atrament">{p.tytul}</span>
              <span className="line-clamp-2 text-sm text-jesien-kora">{zajawka(p.tresc)}</span>
              <span className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-jesien-rdza">
                {p.wideo ? "Obejrzyj i czytaj" : "Czytaj całość"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {otwarty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-jesien-atrament/85 p-3"
          onClick={zamknij}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`post-${otwarty.id}`}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-lg bg-jesien-tlo shadow-xl"
          >
            {/* Warstwa zerowej wysokości: przycisk wisi nad treścią i jedzie
                przy przewijaniu, nie spychając filmu ani grafiki. */}
            <div className="sticky top-0 z-10 flex h-0 justify-end">
              <button
                type="button"
                ref={zamknijRef}
                onClick={zamknij}
                aria-label="Zamknij"
                className="mr-2 mt-2 grid size-9 place-items-center rounded-full bg-jesien-tlo/95
                           text-jesien-atrament shadow-md focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-jesien-rdza"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>
            {otwarty.wideo ? (
              // Pionowa rolka: wysokość z ekranu, żeby opis był tuż pod filmem.
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={otwarty.wideo.plakat}
                src={otwarty.wideo.src}
                className="mx-auto block max-h-[70dvh] w-auto max-w-full bg-jesien-atrament"
              />
            ) : otwarty.grafika ? (
              <Image src={otwarty.grafika} alt="" width={1200} height={1200} sizes="560px" className="w-full" />
            ) : null}
            <div className="grid gap-3 p-5">
              <h3 id={`post-${otwarty.id}`} className="font-tytul text-xl text-jesien-atrament">
                {otwarty.tytul}
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-jesien-kora">{otwarty.tresc}</p>
              {otwarty.link && (
                <a
                  href={otwarty.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-jesien-rdza px-5 text-sm font-bold
                             text-jesien-tlo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
                >
                  {otwarty.link.etykieta}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
