import { WERSJA_ZGOD } from "./zgody";
import type { Dojazd, KluczPuli } from "@/types/db";

export const NAZWY_PUL: Record<KluczPuli, string> = {
  dzialacze: "Działacze",
  swiezaki: "Świeżaki",
  alumni: "Alumni",
};

export const DOJAZDY: { wartosc: Dojazd; etykieta: string }[] = [
  { wartosc: "autokar_oba", etykieta: "Jadę autokarem w obie strony" },
  { wartosc: "autokar_tam", etykieta: "Jadę autokarem tylko na wyjazd" },
  { wartosc: "autokar_powrot", etykieta: "Jadę autokarem tylko na powrót" },
  { wartosc: "wlasny", etykieta: "Dojeżdżam samodzielnie w obie strony" },
];

export function etykietaDojazdu(d: Dojazd): string {
  return DOJAZDY.find((x) => x.wartosc === d)?.etykieta ?? d;
}

export type DaneFormularza = {
  pula: KluczPuli | null;
  akceptujeKlauzule: boolean;
  akceptujeRegulamin: boolean;
  akceptujeSzkody: boolean;
  zgodaWizerunek: boolean;
  imie: string;
  nazwisko: string;
  nrIndeksu: string;
  /** `YYYY-MM-DD` z `<input type="date">`, pusty łańcuch przed wyborem. */
  dataUrodzenia: string;
  telefon: string;
  zgodaSms: boolean;
  iceImie: string;
  iceTelefon: string;
  icePoinformowany: boolean;
  dieta: string;
  alergie: string;
  chorobyLeki: string;
  zgodaArt9: boolean;
  dojazd: Dojazd | "";
  ksywka: string;
  piosenka: string;
  uwagi: string;
};

export const PUSTY_FORMULARZ: DaneFormularza = {
  pula: null,
  akceptujeKlauzule: false,
  akceptujeRegulamin: false,
  akceptujeSzkody: false,
  zgodaWizerunek: false,
  imie: "",
  nazwisko: "",
  nrIndeksu: "",
  dataUrodzenia: "",
  telefon: "",
  zgodaSms: false,
  iceImie: "",
  iceTelefon: "",
  icePoinformowany: false,
  dieta: "",
  alergie: "",
  chorobyLeki: "",
  zgodaArt9: false,
  dojazd: "",
  ksywka: "",
  piosenka: "",
  uwagi: "",
};

export type Krok = "pula" | "zasady" | "dane" | "ice" | "zdrowie" | "oTobie" | "przelew";

/** Kolejność kroków. Rezerwa nie ma kroku przelewu (D3 speca). */
export function kroki(naRezerwe: boolean): Krok[] {
  const wszystkie: Krok[] = ["pula", "zasady", "dane", "ice", "zdrowie", "oTobie", "przelew"];
  return naRezerwe ? wszystkie.filter((k) => k !== "przelew") : wszystkie;
}

export type Bledy = Partial<Record<keyof DaneFormularza, string>>;

// Te same wzorce co w zloz_zgloszenie(). Zmiana jednego bez drugiego da
// formularz, który przepuszcza, i bazę, która odbija — albo odwrotnie.
const TELEFON = /^\+?[0-9 ()-]{9,20}$/;
const INDEKS = /^[0-9]{4,10}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Dzień wyjazdu w Warszawie jako `YYYY-MM-DD`. */
function dzienWyjazdu(dataJwkIso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dataJwkIso));
}

/**
 * Najpóźniejsza dozwolona data urodzenia (D7). Liczona jako tekst, bo
 * `YYYY-MM-DD` porównuje się leksykograficznie tak samo jak chronologicznie,
 * a arytmetyka na `Date` wciągnęłaby strefę przeglądarki.
 */
export function progPelnoletnosci(dataJwkIso: string): string {
  const [rok, miesiac, dzien] = dzienWyjazdu(dataJwkIso).split("-");
  return `${Number(rok) - 18}-${miesiac}-${dzien}`;
}

export function komunikatWieku(dataJwkIso: string): string {
  const slownie = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dataJwkIso));
  return `Na JWK26 jadą osoby, które ${slownie} mają skończone 18 lat.`;
}

const puste = (s: string) => s.trim() === "";

export function maDaneZdrowotne(d: DaneFormularza): boolean {
  return !puste(d.dieta) || !puste(d.alergie) || !puste(d.chorobyLeki);
}

function maIce(d: DaneFormularza): boolean {
  return !puste(d.iceImie) || !puste(d.iceTelefon);
}

/** Błędy jednego kroku. Pusty obiekt znaczy „można dalej". */
export function waliduj(krok: Krok, d: DaneFormularza, dataJwkIso: string): Bledy {
  const b: Bledy = {};

  switch (krok) {
    case "pula":
      if (!d.pula) b.pula = "Wybierz swoją turę";
      break;

    case "zasady":
      if (!d.akceptujeKlauzule) b.akceptujeKlauzule = "Potwierdź, że znasz klauzulę informacyjną";
      if (!d.akceptujeRegulamin) b.akceptujeRegulamin = "Bez akceptacji regulaminu nie da się pojechać";
      if (!d.akceptujeSzkody) b.akceptujeSzkody = "Bez akceptacji oświadczenia nie da się pojechać";
      break;

    case "dane":
      if (puste(d.imie)) b.imie = "Podaj imię";
      else if (d.imie.trim().length > 60) b.imie = "Najwyżej 60 znaków";

      if (puste(d.nazwisko)) b.nazwisko = "Podaj nazwisko";
      else if (d.nazwisko.trim().length > 60) b.nazwisko = "Najwyżej 60 znaków";

      if (puste(d.nrIndeksu)) {
        if (d.pula !== "alumni") b.nrIndeksu = "Podaj numer indeksu";
      } else if (!INDEKS.test(d.nrIndeksu.trim())) {
        b.nrIndeksu = "Numer indeksu to od 4 do 10 cyfr";
      }

      if (!DATA.test(d.dataUrodzenia)) b.dataUrodzenia = "Podaj datę urodzenia";
      else if (d.dataUrodzenia > progPelnoletnosci(dataJwkIso)) {
        b.dataUrodzenia = komunikatWieku(dataJwkIso);
      }

      if (!TELEFON.test(d.telefon.trim())) b.telefon = "Podaj numer telefonu, np. 600 100 200";
      break;

    case "ice":
      if (maIce(d)) {
        if (puste(d.iceImie)) b.iceImie = "Podaj imię tej osoby";
        if (!TELEFON.test(d.iceTelefon.trim())) b.iceTelefon = "Podaj numer telefonu tej osoby";
        if (!d.icePoinformowany) b.icePoinformowany = "Potwierdź, że ta osoba wie o podaniu numeru";
      }
      break;

    case "zdrowie":
      if (maDaneZdrowotne(d) && !d.zgodaArt9) {
        b.zgodaArt9 = "Bez zgody nie możemy przyjąć tych informacji. Zaznacz ją albo wyczyść pola.";
      }
      break;

    case "oTobie":
      if (!d.dojazd) b.dojazd = "Wybierz sposób dojazdu";
      if (puste(d.ksywka)) b.ksywka = "Podaj, jak cię podpisać";
      else if (d.ksywka.trim().length > 24) b.ksywka = "Najwyżej 24 znaki";
      break;

    case "przelew":
      // Plik sprawdza komponent — nie jest częścią DaneFormularza.
      break;
  }

  return b;
}

const alboNull = (s: string) => (puste(s) ? null : s.trim());

/** Parametry `p_dane` i `p_wrazliwe` dla zloz_zgloszenie(). */
export function doRpc(d: DaneFormularza) {
  const p_dane = {
    pula: d.pula,
    imie: d.imie.trim(),
    nazwisko: d.nazwisko.trim(),
    nr_indeksu: alboNull(d.nrIndeksu),
    data_urodzenia: d.dataUrodzenia,
    telefon: d.telefon.trim(),
    sms_consent: d.zgodaSms,
    dojazd: d.dojazd,
    ksywka: d.ksywka.trim(),
    piosenka: alboNull(d.piosenka),
    uwagi: alboNull(d.uwagi),
    zgoda_wizerunek: d.zgodaWizerunek,
    wersja_zgod: WERSJA_ZGOD,
    akceptuje_klauzule: d.akceptujeKlauzule,
    akceptuje_regulamin: d.akceptujeRegulamin,
    akceptuje_szkody: d.akceptujeSzkody,
  };

  const ice = maIce(d);
  const zdrowie = maDaneZdrowotne(d);

  // null zamiast obiektu z samymi nullami: funkcja zakłada wiersz w
  // dane_wrazliwe tylko wtedy, gdy jest co w nim zapisać.
  const p_wrazliwe =
    ice || zdrowie
      ? {
          ice_imie: ice ? alboNull(d.iceImie) : null,
          ice_telefon: ice ? alboNull(d.iceTelefon) : null,
          ice_poinformowany: ice && d.icePoinformowany,
          dieta: alboNull(d.dieta),
          alergie: alboNull(d.alergie),
          choroby_leki: alboNull(d.chorobyLeki),
          zgoda_art9: zdrowie && d.zgodaArt9,
        }
      : null;

  return { p_dane, p_wrazliwe };
}
