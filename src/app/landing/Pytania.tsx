import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { KOORDYNATOR_MAIL, KOORDYNATOR_TELEFON } from "@/lib/regulamin";

// Odpowiedzi oparte na regulaminie i formularzu zapisów — nic, czego system
// albo regulamin nie mówi. Poprawki treści idą przez rozmowę z właścicielem.
const PYTANIA = [
  {
    pytanie: "Kto może jechać?",
    odpowiedz:
      "Pełnoletnie osoby z komisji, jednostek i projektów Samorządu, świeżaki przyjęci w tegorocznej " +
      "rekrutacji i Alumni — wszyscy logują się kontem @samorzad.ue.wroc.pl. Szczegóły w § 3 regulaminu.",
  },
  {
    pytanie: "Co, jeśli tura jest pełna?",
    odpowiedz:
      "Zapiszesz się na listę rezerwową bez wpłaty. Gdy zwolni się miejsce, organizator przesuwa kolejną " +
      "osobę z rezerwy i prosi ją o wpłatę.",
  },
  {
    pytanie: "Co, jeśli zrezygnuję?",
    odpowiedz:
      "Napisz do koordynatora jak najszybciej. Skutki finansowe rezygnacji określają warunki płatności " +
      "przekazane przed wpłatą (§ 17 regulaminu).",
  },
  {
    pytanie: "Jak dojeżdżamy?",
    odpowiedz:
      "Autokarem albo własnym transportem — w formularzu wybierasz autokar w obie strony, tylko tam, tylko " +
      "z powrotem albo dojazd własny. Godzinę i miejsce zbiórki podamy przed wyjazdem.",
  },
  {
    pytanie: "Co z jedzeniem i dietami?",
    odpowiedz: "Dietę i alergie podajesz w formularzu, dobrowolnie. Ośrodek dostaje wyłącznie te informacje.",
  },
  {
    pytanie: "Czy zgłoszenie może zostać odrzucone?",
    odpowiedz:
      "Tak, jeśli w formularzu czegoś zabraknie albo nie da się zweryfikować potwierdzenia przelewu. " +
      "Decyzję zobaczysz po zalogowaniu w aplikacji.",
  },
] as const;

/**
 * „Najczęstsze pytania" — natywne `<details>`/`<summary>`: działają bez
 * JavaScriptu, są dostępne z klawiatury (Tab + Enter/Spacja) i nie
 * potrzebują żadnego stanu Reacta do otwierania/zamykania. Domyślny
 * trójkącik znacznika jest ukryty i zastąpiony własnym, obracanym przez
 * `group-open:` — więc nie wygląda jak nieostylowany widget przeglądarki.
 *
 * Kontakt pod listą to koordynator z regulaminu (§ 17, § 20) — te same stałe.
 */
export function Pytania() {
  return (
    <section id="pytania" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="08" nadtytul="Pytania" tytul="Najczęstsze pytania" />

        <div className="grid gap-3">
          {PYTANIA.map((p) => (
            <details
              key={p.pytanie}
              className="group rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 px-5 py-4"
            >
              <summary
                className="flex min-h-11 list-none items-center justify-between gap-3 text-sm
                           font-bold text-jesien-atrament [&::-webkit-details-marker]:hidden"
              >
                {p.pytanie}
                <svg
                  viewBox="0 0 20 20"
                  className="size-4 shrink-0 text-jesien-rdza transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5 L10 12.5 L15 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-jesien-kora">{p.odpowiedz}</p>
            </details>
          ))}
        </div>

        <div className="mt-6 grid gap-1 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5 text-sm">
          <p className="font-bold text-jesien-atrament">
            Nie znalazłeś odpowiedzi? Koordynator wyjazdu: Dawid Rutkowski
          </p>
          <a
            href={`mailto:${KOORDYNATOR_MAIL}`}
            className="w-fit font-bold text-jesien-rdza underline underline-offset-2"
          >
            {KOORDYNATOR_MAIL}
          </a>
          <a
            href={`tel:${KOORDYNATOR_TELEFON.replace(/\s/g, "")}`}
            className="w-fit text-jesien-rdza underline underline-offset-2"
          >
            {KOORDYNATOR_TELEFON}
          </a>
        </div>
      </Kontener>
    </section>
  );
}
