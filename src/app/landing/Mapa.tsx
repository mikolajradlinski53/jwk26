"use client";

import { useState } from "react";

/**
 * Mapa w karcie ośrodka: adres, „Otwórz w Mapach” i osadzona mapa dopiero po
 * dotknięciu (ciężki iframe nie leci do każdego, kto przewinął stronę -
 * landing trafia z Instagrama też do ludzi na limicie danych).
 *
 * Adres przychodzi z bazy - w kodzie nie ma żadnego, więc przed odsłoną
 * ośrodka nie ma go też w skryptach strony.
 */
export function Mapa({ nazwa, adres }: { nazwa: string | null; adres: string }) {
  const [pokaz, setPokaz] = useState(false);
  const pelny = [nazwa, adres].filter(Boolean).join(", ");
  const kodowany = encodeURIComponent(pelny);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${kodowany}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-full border border-jesien-rdza/40 bg-jesien-tlo px-4 text-sm
                     font-bold text-jesien-rdza focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-jesien-rdza"
        >
          Otwórz w Mapach
        </a>
        {!pokaz && (
          <button
            type="button"
            onClick={() => setPokaz(true)}
            className="flex min-h-11 items-center rounded-full border border-jesien-kora/25 px-4 text-sm text-jesien-kora
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
          >
            Pokaż mapę tutaj
          </button>
        )}
      </div>
      {pokaz && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg min-[850px]:aspect-[21/9]">
          <iframe
            src={`https://maps.google.com/maps?q=${kodowany}&output=embed`}
            title={`Mapa: ${pelny}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0"
          />
        </div>
      )}
    </div>
  );
}
