import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";

const PYTANIA = [
  {
    pytanie: "Czy trzeba być w Samorządzie?",
    odpowiedz:
      "Tak — wyjazd jest dla osób z Samorządu Studenckiego UE we Wrocławiu. " +
      "Logowanie w formularzu wymaga adresu w domenie @samorzad.ue.wroc.pl.",
  },
  {
    pytanie: "Co, jeśli zrezygnuję?",
    odpowiedz:
      "Zasady zwrotu wpłaty ustala organizator. Zgłoś rezygnację jak najszybciej, " +
      "jak tylko wiesz, że nie jedziesz.",
  },
  {
    pytanie: "Jak dojeżdżamy?",
    odpowiedz: "Szczegóły transportu poda organizator przed wyjazdem.",
  },
  {
    pytanie: "Co z jedzeniem i dietami?",
    odpowiedz:
      "O szczególnych potrzebach żywieniowych — diecie, alergiach — trzeba " +
      "poinformować organizatora.",
  },
  {
    pytanie: "Czy zgłoszenie może zostać odrzucone?",
    odpowiedz:
      "Tak, jeśli w formularzu czegoś zabraknie albo nie da się zweryfikować " +
      "potwierdzenia przelewu. Decyzję zobaczysz po zalogowaniu w aplikacji.",
  },
] as const;

const KONTAKT_MAIL = "samorzad@samorzad.ue.wroc.pl";

/**
 * „Najczęstsze pytania" — natywne `<details>`/`<summary>`: działają bez
 * JavaScriptu, są dostępne z klawiatury (Tab + Enter/Spacja) i nie
 * potrzebują żadnego stanu Reacta do otwierania/zamykania. Domyślny
 * trójkącik znacznika jest ukryty i zastąpiony własnym, obracanym przez
 * `group-open:` — więc nie wygląda jak nieostylowany widget przeglądarki.
 */
export function Pytania() {
  return (
    <section id="pytania" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="07" nadtytul="Pytania" tytul="Najczęstsze pytania" />

        <div className="grid gap-3">
          {PYTANIA.map((p) => (
            <details
              key={p.pytanie}
              className="group rounded-lg border border-jesien-kora/15 bg-jesien-karta px-5 py-4"
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

        <p className="mt-6 text-sm leading-relaxed text-jesien-kora">
          Nie znalazłeś odpowiedzi?{" "}
          <a
            href={`mailto:${KONTAKT_MAIL}`}
            className="font-bold text-jesien-rdza underline underline-offset-2"
          >
            {KONTAKT_MAIL}
          </a>
        </p>
      </Kontener>
    </section>
  );
}
