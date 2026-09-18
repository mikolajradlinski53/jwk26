import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

const GRUPY = [
  {
    tytul: "Ubranie",
    rzeczy: [
      "Ciepłe ubrania warstwowo",
      "Kurtka przeciwdeszczowa",
      "Wygodne buty z podeszwą na mokro",
      "Czapka i rękawiczki",
    ],
  },
  {
    tytul: "Dokumenty",
    rzeczy: ["Dokument tożsamości", "Legitymacja studencka"],
  },
  {
    tytul: "Reszta",
    rzeczy: [
      "Leki przyjmowane na stałe",
      "Ładowarka i powerbank",
      "Ręcznik i kosmetyki",
      "Kapcie lub klapki",
      "Coś do spania, jeśli masz lekki sen",
    ],
  },
] as const;

/**
 * „Co zabrać" — Karpacz w drugiej połowie października to góry, zimno,
 * możliwy deszcz i śnieg. Lista rzeczowa, bez żartów i bez emoji — motyw
 * wizualny landingu opiera się na typografii, nie na ikonkach.
 */
export function CoZabrac() {
  return (
    <section id="co-zabrac" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="06" nadtytul="Przygotowanie" tytul="Co zabrać" />

        <p className="text-sm leading-relaxed text-jesien-kora">
          Karpacz w drugiej połowie października bywa zimny i wilgotny —
          licz się z deszczem, a nawet śniegiem.
        </p>

        <div className="mt-6 grid gap-6 min-[600px]:grid-cols-2 min-[850px]:grid-cols-3">
          {GRUPY.map((grupa) => (
            <div key={grupa.tytul}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">
                {grupa.tytul}
              </h3>
              <ul className="mt-3 grid gap-2">
                {grupa.rzeczy.map((rzecz) => (
                  <li
                    key={rzecz}
                    className="text-sm leading-relaxed text-jesien-kora"
                  >
                    {rzecz}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Kontener>
    </section>
  );
}
