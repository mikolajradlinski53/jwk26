import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { ZabaStala } from "./zaba/ZabaStala";
import { DanePrzelewu } from "@/components/DanePrzelewu";
import type { DanePrzelewu as DanePrzelewuTyp } from "@/lib/zapisy/qrPrzelewu";
import type { OdslonaWidok } from "@/lib/odslony";

const TLO = "bg-jesien-tlo/70";

/**
 * „Cena i wpłata”. Przed odsłoną ceny — zasłona; baza i tak nie wyda wtedy
 * kwoty ani danych do przelewu. Po odsłonie bez danych w panelu: „kwotę
 * podamy wkrótce”, nigdy zmyślona liczba. Dane do przelewu z kodem QR
 * pochodzą z /app/admin/ustawienia.
 */
export function CenaIWplata({ odslona, przelew }: { odslona: OdslonaWidok; przelew: DanePrzelewuTyp | null }) {
  if (!odslona.odsloniete) {
    return (
      <Zaslona
        id="cena-i-wplata"
        numer="05"
        nadtytul="Koszt"
        tytul="Cena i wpłata"
        tlo={TLO}
        ksztalt="cena"
        odslona={odslona}
        zaba={<ZabaStala poza="skarbonka" skala={0.62} polozenie={{ bottom: 0, left: "calc(100% + 8px)" }} />}
      />
    );
  }

  return (
    <section id="cena-i-wplata" className={`${TLO} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener>
        <SekcjaNaglowek numer="05" nadtytul="Koszt" tytul="Cena i wpłata" zaba={<ZabaStala poza="skarbonka" skala={0.62} />} />
        {przelew ? (
          <p className="font-tytul text-5xl text-jesien-rdza min-[600px]:text-6xl">{przelew.kwota} zł</p>
        ) : (
          <p className="font-tytul text-2xl text-jesien-rdza">Kwotę podamy wkrótce</p>
        )}
        <p className="mt-2 text-sm font-bold text-jesien-atrament">Wpłaty przyjmujemy od 12 do 20 października 2026.</p>
        <p className="mt-4 text-sm leading-relaxed text-jesien-kora">
          Cena obejmuje nocleg i wyżywienie w ośrodku, transport oraz program wyjazdu — dokładny zakres
          poda organizator bliżej terminu.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-jesien-kora">
          Potwierdzenie przelewu wgrywa się w formularzu zgłoszeniowym — warto je zachować, zanim zaczniesz
          wypełniać zgłoszenie. Gdy tura jest pełna, zapisujesz się na listę rezerwową bez wpłaty.
        </p>
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
