import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { Zaslona } from "./Zaslona";
import { ZabaStala } from "./zaba/ZabaStala";
import { DanePrzelewu } from "@/components/DanePrzelewu";
import type { DanePrzelewu as DanePrzelewuTyp } from "@/lib/zapisy/qrPrzelewu";
import type { OdslonaWidok } from "@/lib/odslony";

const TLO = "bg-jesien-tlo/70";

/**
 * „Cena”. Przed odsłoną ceny - zasłona; baza i tak nie wyda wtedy kwoty ani
 * danych do przelewu. Po odsłonie bez danych w panelu: „kwotę podamy
 * wkrótce”, nigdy zmyślona liczba. Dane do przelewu z kodem QR pochodzą
 * z /app/admin/ustawienia; teksty od Mikołaja (2026-10-05).
 */
export function CenaIWplata({ odslona, przelew }: { odslona: OdslonaWidok; przelew: DanePrzelewuTyp | null }) {
  if (!odslona.odsloniete) {
    return (
      <Zaslona
        id="cena-i-wplata"
        numer="05"
        nadtytul="Cena"
        tytul="Koszt wyjazdu"
        tlo={TLO}
        ksztalt="cena"
        odslona={odslona}
        zaba={<ZabaStala poza="skarbonka" skala={0.9} polozenie={{ bottom: 0, left: "calc(100% + 8px)" }} />}
      />
    );
  }

  return (
    <section id="cena-i-wplata" className={`${TLO} mx-auto w-full scroll-mt-20 px-4 py-14`}>
      <Kontener>
        <SekcjaNaglowek
          numer="05"
          nadtytul="Cena"
          tytul={przelew ? `Koszt wyjazdu to ${przelew.kwota} zł` : "Kwotę podamy wkrótce"}
          zaba={<ZabaStala poza="skarbonka" skala={1} />}
        />
        <DanePrzelewu
          dane={przelew}
          wariant="jesien"
          tytul="Wyjazd - imię i nazwisko"
          tytulQr="Wyjazd -"
          przypisTytulu="Wpisz swoje imię i nazwisko - formularz zgłoszeniowy zrobi to za Ciebie."
        />
      </Kontener>
    </section>
  );
}
