import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Licznik } from "./Licznik";
import { PrzyciskZapisu } from "./PrzyciskZapisu";
import { odliczanie } from "@/lib/odliczanie";
import type { OdslonaWidok } from "@/lib/odslony";

const KROKI = [
  {
    numer: "01",
    tytul: "Zaloguj się kontem Samorządu",
    opis:
      "Logujesz się jednym dotknięciem przez Google, adresem @samorzad.ue.wroc.pl — " +
      "także jeśli jesteś w Alumni.",
  },
  {
    numer: "02",
    tytul: "Wybierz turę i wypełnij formularz",
    opis:
      "Wybierz swoją turę, zaakceptuj zasady, podaj dane i dołącz czytelne zdjęcie albo zrzut " +
      "ekranu potwierdzenia przelewu. Gdy tura jest pełna, zapiszesz się na listę rezerwową bez wpłaty.",
  },
  {
    numer: "03",
    tytul: "Poczekaj na decyzję",
    opis:
      "Zgłoszenie sprawdza organizator. Może zostać odrzucone, jeśli czegoś zabraknie albo nie da się " +
      "zweryfikować przelewu. Decyzję zobaczysz po zalogowaniu w aplikacji — a jeśli włączysz " +
      "powiadomienia, dostaniesz też powiadomienie.",
  },
] as const;

/**
 * „Zapisy” — tury opisane na stałe (bez stanu na żywo i bez dat; decyzja
 * właściciela), lista rezerwowa, trzy kroki i przycisk zapisu, który do
 * odsłony zapisów jest licznikiem. Licznik przyjęcia świeżaków mieszka
 * w karcie ich tury — tylko tam ma sens.
 *
 * Krok 03 mówi „w aplikacji”, nie „przyjdzie e-mail”: system nie wysyła
 * maili z decyzją, a obietnica maila byłaby pusta.
 */
export function Zapisy({ zapisy, dataSwiezakow }: { zapisy: OdslonaWidok; dataSwiezakow: string | null }) {
  return (
    <section id="zapisy" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="04" nadtytul="Zgłoszenie" tytul="Zapisy" />

        <div className="grid gap-4 min-[850px]:grid-cols-3">
          <div className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Działacze</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">
              Osoby działające w komisjach, jednostkach i projektach Samorządu. Ich tura rusza pierwsza.
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Świeżaki</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">
              Nowi członkowie Samorządu przyjęci w tegorocznej rekrutacji. Tura rusza po przyjęciu świeżaków.
            </p>
            <Licznik
              docelowa={dataSwiezakow}
              etykieta="Do przyjęcia świeżaków"
              poTerminie="Przyjęcie za nami"
              poczatkowe={odliczanie(dataSwiezakow, new Date())}
            />
          </div>
          <div className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Alumni</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">Byli członkowie Samorządu. Tura rusza na końcu.</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-jesien-kora">
          Każda tura ma ustaloną liczbę miejsc. Gdy się zapełni, zapiszesz się na listę rezerwową bez
          wpłaty — jeśli ktoś zrezygnuje, organizator przesuwa kolejną osobę z rezerwy i prosi ją
          o wpłatę. Otwarcie każdej tury ogłaszamy na Instagramie.
        </p>

        <div className="mt-8 grid gap-4 min-[850px]:grid-cols-3">
          {KROKI.map((k) => (
            <div key={k.numer} className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
              <span className="font-tytul text-2xl text-jesien-rdza/40">{k.numer}</span>
              <h3 className="font-tytul text-lg text-jesien-atrament">{k.tytul}</h3>
              <p className="text-sm leading-relaxed text-jesien-kora">{k.opis}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <PrzyciskZapisu odslona={zapisy} wariant="sekcja" />
        </div>
      </Kontener>
    </section>
  );
}
