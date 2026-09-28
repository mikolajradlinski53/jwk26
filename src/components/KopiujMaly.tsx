"use client";

import { useState } from "react";

/**
 * Mały przycisk „Kopiuj" obok wartości do przepisania (numer konta, tytuł).
 * Kolor bierze z otoczenia (`currentColor`), więc pasuje i do ciemnej apki,
 * i do jasnego landinga. Brak API schowka — np. w przeglądarce wbudowanej
 * w Instagrama — kończy się komunikatem, nie martwym przyciskiem.
 */
export function KopiujMaly({ tekst, co }: { tekst: string; co: string }) {
  const [stan, setStan] = useState<"gotowy" | "skopiowano" | "nie-udalo-sie">("gotowy");

  async function kopiuj() {
    try {
      if (!navigator.clipboard) throw new Error("brak schowka");
      await navigator.clipboard.writeText(tekst);
      setStan("skopiowano");
    } catch {
      setStan("nie-udalo-sie");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void kopiuj()}
      aria-label={`Skopiuj ${co}`}
      className="min-h-11 shrink-0 rounded-full border border-current/40 px-3.5 text-xs font-bold
                 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span aria-live="polite">
        {stan === "skopiowano" ? "Skopiowano" : stan === "nie-udalo-sie" ? "Przepisz ręcznie" : "Kopiuj"}
      </span>
    </button>
  );
}
