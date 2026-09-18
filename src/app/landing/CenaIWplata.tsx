import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

/**
 * „Cena i wpłata" — kwota jako najmocniejszy element sekcji, termin wpłat,
 * ogólny opis tego, co obejmuje cena (bez zmyślania szczegółów, których nie
 * znamy — te poda organizator), przypomnienie o wgraniu potwierdzenia
 * w formularzu i miejsce na numer konta + kod QR, których jeszcze nie mamy.
 */
export function CenaIWplata() {
  return (
    <section
      id="cena-i-wplata"
      className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14"
    >
      <Kontener>
        <SekcjaNaglowek numer="04" nadtytul="Koszt" tytul="Cena i wpłata" />

        <p className="font-tytul text-5xl text-jesien-rdza min-[600px]:text-6xl">320 zł</p>
        <p className="mt-2 text-sm font-bold text-jesien-atrament">
          Wpłaty przyjmujemy od 12 do 22 października 2026.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-jesien-kora">
          Cena obejmuje nocleg i wyżywienie w ośrodku, transport oraz program
          wyjazdu — dokładny zakres poda organizator bliżej terminu.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-jesien-kora">
          Potwierdzenie przelewu wgrywa się w formularzu zgłoszeniowym —
          warto je zachować, zanim zaczniesz wypełniać zgłoszenie.
        </p>

        {/*
          Miejsce na dane do przelewu — numeru konta jeszcze nie mamy, więc
          zamiast go zmyślać zostaje wyraźnie oznaczony placeholder.
          PODMIEŃ TUTAJ: numer konta poniżej („(numer konta pojawi się
          wkrótce)") i, jeśli organizator go dostarczy, kod QR w miejscu
          oznaczonego kwadratu — struktura karty jest już gotowa na oba.
        */}
        <div className="mt-6 rounded-lg border-2 border-dashed border-jesien-dynia/60 bg-jesien-tlo/70 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">
            Dane do przelewu
          </p>
          <div className="mt-3 flex flex-col items-center gap-4 min-[500px]:flex-row min-[500px]:items-center">
            <div className="grid size-24 shrink-0 place-items-center rounded-md border border-jesien-kora/25 bg-jesien-karta text-center text-[10px] leading-tight text-jesien-kora">
              Kod QR
              <br />
              wkrótce
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-bold text-jesien-atrament">Numer konta</p>
              <p className="text-sm text-jesien-kora">(numer konta pojawi się wkrótce)</p>
              <p className="mt-1 text-xs text-jesien-kora/80">
                Dane pojawią się tutaj, gdy tylko organizator je poda.
              </p>
            </div>
          </div>
        </div>
      </Kontener>
    </section>
  );
}
