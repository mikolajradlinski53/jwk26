import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { ZabaStala } from "./zaba/ZabaStala";
import { Licznik } from "./Licznik";
import { PrzyciskZapisu } from "./PrzyciskZapisu";
import { odliczanie } from "@/lib/odliczanie";
import type { OdslonaWidok } from "@/lib/odslony";

const KROKI = [
  {
    numer: "01",
    tytul: "Zaloguj się kontem Samorządowym",
    opis:
      "Logujesz się jednym dotknięciem przez Google, swoim adresem @samorzad.ue.wroc.pl - " +
      "także jeśli jesteś Alumnem.",
  },
  {
    numer: "02",
    tytul: "Wybierz swoją turę i wypełnij formularz",
    opis:
      "Wybierz turę, zaakceptuj zasady, uzupełnij swoje dane i dołącz czytelne zdjęcie albo zrzut " +
      "ekranu potwierdzający przelew. Gdy tura się zapełni - zapisz się na listę rezerwową bez wpłaty.",
  },
  {
    numer: "03",
    tytul: "Poczekaj na decyzję",
    opis:
      "Zgłoszenie sprawdzi organizator. Może zostać ono odrzucone, jeśli czegoś zabraknie lub nie " +
      "prześlesz potwierdzenia wpłaty. Po weryfikacji decyzję zobaczysz po zalogowaniu w aplikacji - " +
      "a jeśli włączysz powiadomienia, to również je dostaniesz.",
  },
] as const;

/**
 * „Tury zapisów” - tury opisane na stałe (bez stanu na żywo i bez dat;
 * decyzja właściciela), lista rezerwowa, trzy kroki i przycisk zapisu, który
 * do odsłony zapisów jest licznikiem. Licznik przyjęcia Świeżaków mieszka
 * w karcie ich tury - tylko tam ma sens. Teksty od Mikołaja (2026-10-05).
 *
 * Krok 03 mówi „w aplikacji”, nie „przyjdzie e-mail”: system nie wysyła
 * uczestnikom maili z decyzją, a obietnica maila byłaby pusta.
 */
export function Zapisy({ zapisy, dataSwiezakow }: { zapisy: OdslonaWidok; dataSwiezakow: string | null }) {
  return (
    <section id="zapisy" className="bg-jesien-karta/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener wariant="szeroki">
        <SekcjaNaglowek numer="04" nadtytul="Zgłoszenie" tytul="Tury zapisów" zaba={<ZabaStala poza="pisze" skala={1} />} />

        <p className="mb-5 text-sm leading-relaxed text-jesien-kora">
          Zapisy odbywają się wyłącznie za pośrednictwem strony internetowej.
        </p>

        <div className="grid gap-4 min-[850px]:grid-cols-3">
          <div className="grid content-start gap-2 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Działacze</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">
              Osoby działające w komisjach i jednostkach Samorządu. Ta tura rusza pierwsza.
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border border-jesien-kora/15 bg-jesien-tlo/80 p-5">
            <h3 className="font-tytul text-lg text-jesien-atrament">Świeżaki</h3>
            <p className="text-sm leading-relaxed text-jesien-kora">
              Nowi członkowie komisji Samorządu przyjęci w tegorocznej rekrutacji. Tura rusza po przyjęciu
              Świeżaków.
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
            <p className="text-sm leading-relaxed text-jesien-kora">
              Byli członkowie komisji Samorządu. Tura rusza jako ostatnia, jeśli pozostaną wolne miejsca
              i nie zostaną one zapełnione z listy rezerwowej.
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-jesien-kora">
          Każda tura dotyczy określonej liczby miejsc. Gdy się zapełni - możesz zapisać się na listę
          rezerwową. <strong className="text-jesien-atrament">Na tym etapie za nic jeszcze nie płacisz!</strong>{" "}
          Jeśli pojawi się wolne miejsce, organizator poinformuje Cię o tym oraz poprosi o wpłatę.
        </p>

        <h3 className="mt-10 font-tytul text-xl text-jesien-atrament">Jak się zapisać?</h3>

        <div className="mt-4 grid gap-4 min-[850px]:grid-cols-3">
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
