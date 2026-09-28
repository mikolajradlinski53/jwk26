import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { DanePrzelewu } from "@/components/DanePrzelewu";
import type { DanePrzelewu as DanePrzelewuTyp } from "@/lib/zapisy/qrPrzelewu";

/**
 * „Cena i wpłata" — kwota jako najmocniejszy element sekcji, termin wpłat,
 * ogólny opis tego, co obejmuje cena (bez zmyślania szczegółów, których nie
 * znamy — te poda organizator), przypomnienie o wgraniu potwierdzenia
 * w formularzu oraz dane do przelewu z kodem QR z ustawień admina.
 */
export function CenaIWplata({ przelew }: { przelew: DanePrzelewuTyp | null }) {
  return (
    <section
      id="cena-i-wplata"
      className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14"
    >
      <Kontener>
        <SekcjaNaglowek numer="04" nadtytul="Koszt" tytul="Cena i wpłata" />

        <p className="font-tytul text-5xl text-jesien-rdza min-[600px]:text-6xl">
          {przelew?.kwota ?? 320} zł
        </p>
        <p className="mt-2 text-sm font-bold text-jesien-atrament">
          Wpłaty przyjmujemy od 12 do 20 października 2026.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-jesien-kora">
          Cena obejmuje nocleg i wyżywienie w ośrodku, transport oraz program
          wyjazdu - dokładny zakres poda organizator bliżej terminu.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-jesien-kora">
          Potwierdzenie przelewu wgrywa się w formularzu zgłoszeniowym —
          warto je zachować, zanim zaczniesz wypełniać zgłoszenie.
        </p>

        {/* Numer konta, odbiorca i kwota z /app/admin/ustawienia. Zanim admin
            je poda, karta mówi „wkrótce" zamiast pokazywać zmyślony numer. */}
        <div className="mt-6">
          <DanePrzelewu
            dane={przelew}
            wariant="jesien"
            tytul="JWK26"
            przypisTytulu="Dopisz w tytule swoje imię i nazwisko — formularz zgłoszeniowy zrobi to za Ciebie."
          />
        </div>
      </Kontener>
    </section>
  );
}
