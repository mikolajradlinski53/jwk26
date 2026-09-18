import Link from "next/link";
import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

const KROKI = [
  {
    numer: "01",
    tytul: "Zaloguj się kontem uczelnianym",
    opis:
      "Wejdź na stronę logowania i zaloguj się jednym dotknięciem przez Google, " +
      "używając adresu w domenie @samorzad.ue.wroc.pl.",
  },
  {
    numer: "02",
    tytul: "Wypełnij formularz i wgraj potwierdzenie przelewu",
    opis:
      "Podaj dane kontaktowe, zaznacz zgodę na SMS-y i dołącz czytelne zdjęcie " +
      "albo zrzut ekranu potwierdzenia przelewu.",
  },
  {
    numer: "03",
    tytul: "Poczekaj na decyzję",
    opis:
      "Zgłoszenie sprawdza organizator. Może zostać odrzucone, jeśli w formularzu " +
      "czegoś zabraknie albo nie da się zweryfikować potwierdzenia przelewu — bo " +
      "zdjęcie jest nieczytelne, kwota się nie zgadza albo brakuje tytułu przelewu. " +
      "Decyzję zobaczysz po zalogowaniu w aplikacji.",
  },
] as const;

/**
 * „Jak się zapisać" — trzy kroki od logowania po decyzję organizatora.
 *
 * Krok 03 niesie dwa twarde wymagania z brifu naraz: rzeczowe ostrzeżenie,
 * że zgłoszenie może zostać odrzucone (bez straszenia, ale bez ściemniania),
 * i dokładne sformułowanie o tym, gdzie widać decyzję — „po zalogowaniu
 * w aplikacji", nigdy „przyjdzie e-mail". System nie wysyła żadnych
 * wiadomości, więc obietnica maila byłaby dla ~65 osób obietnicą pustą.
 */
export function JakSieZapisac() {
  return (
    <section
      id="jak-sie-zapisac"
      className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14"
    >
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="05" nadtytul="Zgłoszenie" tytul="Jak się zapisać" />

        <div className="grid gap-4 min-[850px]:grid-cols-3">
          {KROKI.map((krok) => (
            <div
              key={krok.numer}
              className="grid gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5"
            >
              <span className="font-tytul text-2xl text-jesien-rdza/40">{krok.numer}</span>
              <h3 className="font-tytul text-lg text-jesien-atrament">{krok.tytul}</h3>
              <p className="text-sm leading-relaxed text-jesien-kora">{krok.opis}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/wejscie"
            className="flex min-h-12 w-[min(280px,80vw)] items-center justify-center rounded-full
                       bg-jesien-rdza px-5 text-sm font-bold text-white transition hover:brightness-110
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jesien-rdza"
          >
            Zapisz się
          </Link>
        </div>
      </Kontener>
    </section>
  );
}
