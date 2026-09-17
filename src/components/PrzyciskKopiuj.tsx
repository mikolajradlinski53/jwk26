"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Kopiuje adres strony do schowka.
 *
 * Obsługa błędu nie jest tu ostrożnością na wszelki wypadek: ten przycisk
 * pokazuje się właśnie w przeglądarce wbudowanej w Instagrama, czyli tam,
 * gdzie ograniczenia API schowka są najbardziej prawdopodobne. Bez tego
 * odczyt `navigator.clipboard.writeText` na niedostępnym API rzucał wyjątek
 * w obsłudze kliknięcia, stan nigdy się nie zmieniał, a człowiek klikał
 * w przycisk, który nie robił nic i nie tłumaczył dlaczego.
 */
export function PrzyciskKopiuj({ adres }: { adres: string }) {
  const [stan, setStan] = useState<"gotowy" | "skopiowano" | "nie-udalo-sie">(
    "gotowy",
  );

  async function kopiuj() {
    try {
      if (!navigator.clipboard) throw new Error("brak schowka");
      await navigator.clipboard.writeText(adres);
      setStan("skopiowano");
    } catch {
      setStan("nie-udalo-sie");
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={kopiuj}>
        {stan === "skopiowano" ? "Skopiowano adres" : "Skopiuj adres"}
      </Button>
      {stan === "nie-udalo-sie" && (
        <p className="text-center text-sm text-krew-jasna">
          Nie udało się skopiować. Przepisz ręcznie:{" "}
          <span className="break-words text-kosc">{adres}</span>
        </p>
      )}
    </div>
  );
}
