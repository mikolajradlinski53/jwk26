/**
 * Teksty prawne formularza zapisów. Jedno miejsce, jedna wersja.
 *
 * Każda zmiana treści wymaga podbicia WERSJA_ZGOD — zgłoszenie zapisuje wersję,
 * którą uczestnik zobaczył, i tylko po niej da się potem ustalić, na co się
 * zgodził. Baza tego nie wyłapie; to reguła przeglądu kodu (D8 speca).
 *
 * Wersja robocza, do przejrzenia przez IOD i dział prawny UEW przed otwarciem
 * pierwszej tury. Autor nie jest prawnikiem.
 */
export const WERSJA_ZGOD = "2026-09-27";

export const KONTAKT_IOD = "iod@ue.wroc.pl";

const ADMINISTRATOR =
  "Uniwersytet Ekonomiczny we Wrocławiu, ul. Komandorska 118/120, 53-345 Wrocław";

/** Klauzula informacyjna z art. 13 RODO — akapit na element. */
export const KLAUZULA_INFORMACYJNA: string[] = [
  `Administratorem Twoich danych osobowych jest ${ADMINISTRATOR}. ` +
    `Z Inspektorem Ochrony Danych skontaktujesz się pod adresem ${KONTAKT_IOD}.`,
  "Imię, nazwisko, numer indeksu, datę urodzenia, telefon, sposób dojazdu " +
    "i podpis na identyfikatorze przetwarzamy, żeby zorganizować Jesienny " +
    "Wyjazd Komisji 2026 (JWK26), na podstawie art. 6 ust. 1 lit. b RODO — " +
    "bierzesz w nim udział na własny wniosek. Datę urodzenia wykorzystujemy " +
    "także do sprawdzenia, czy w dniu wyjazdu masz ukończone 18 lat.",
  "Akceptację oświadczenia o odpowiedzialności za szkody i dane potrzebne do " +
    "dochodzenia roszczeń przetwarzamy na podstawie art. 6 ust. 1 lit. f RODO, " +
    "czyli prawnie uzasadnionego interesu organizatora.",
  "Dane osoby do kontaktu w nagłym wypadku (ICE) przetwarzamy na podstawie " +
    "art. 6 ust. 1 lit. f RODO, wyłącznie po to, żeby móc ją powiadomić " +
    "w sytuacji wyjątkowej.",
  "Informacje o diecie, alergiach, chorobach przewlekłych i przyjmowanych " +
    "lekach przetwarzamy wyłącznie na podstawie Twojej wyraźnej zgody " +
    "(art. 9 ust. 2 lit. a RODO), żeby przygotować odpowiednie posiłki " +
    "i udzielić pomocy w sytuacji wyjątkowej. Wizerunek rozpowszechniamy " +
    "wyłącznie na podstawie zgody (art. 6 ust. 1 lit. a RODO i art. 81 ustawy " +
    "o prawie autorskim i prawach pokrewnych). Zgoda na SMS-y organizacyjne " +
    "również jest dobrowolna.",
  "Dane widzą organizatorzy wyjazdu. Ośrodek otrzymuje wyłącznie informacje " +
    "o diecie i alergiach. Dane są przechowywane u dostawców infrastruktury " +
    "(Supabase, Vercel), którzy przetwarzają je na nasze zlecenie.",
  "Informacje o zdrowiu i dane osoby ICE usuwamy 14 dni po zakończeniu " +
    "wyjazdu. Pozostałe dane ze zgłoszenia przechowujemy do 31 grudnia 2027 " +
    "roku, żeby móc rozliczyć ewentualne szkody z ośrodkiem.",
  "Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, " +
    "ograniczenia przetwarzania i wniesienia sprzeciwu, a także prawo " +
    "wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych. Każdą zgodę " +
    "możesz wycofać w dowolnym momencie w aplikacji; wycofanie nie wpływa na " +
    "zgodność z prawem przetwarzania sprzed wycofania.",
  "Podanie danych z kroków „Dane” i „O tobie” jest warunkiem udziału " +
    "w wyjeździe. Kontakt ICE, informacje o zdrowiu i zgoda na wizerunek są " +
    "dobrowolne — bez nich też pojedziesz.",
];

export const OSWIADCZENIE_SZKODY =
  "Oświadczam, że odpowiadam za szkody w mieniu ośrodka wyrządzone przeze mnie " +
  "w czasie wyjazdu. Jeżeli szkoda powstanie w pokoju, w którym mam przydzielone " +
  "miejsce według listy zakwaterowania prowadzonej przez organizatora, a osoby, " +
  "która ją wyrządziła, nie da się ustalić albo nikt nie przyzna się do jej " +
  "wyrządzenia, odpowiadam za nią solidarnie z pozostałymi osobami, które mają " +
  "miejsce w tym pokoju. Organizator — Uniwersytet Ekonomiczny we Wrocławiu, " +
  "reprezentowany przez koordynatora wyjazdu — może żądać pokrycia szkody, " +
  "a w razie odmowy dochodzić jej na drodze postępowania cywilnego.";

export const ZGODA_WIZERUNEK =
  "Zgadzam się na nieodpłatne rozpowszechnianie mojego wizerunku utrwalonego " +
  "podczas JWK26 na stronie internetowej, w materiałach promocyjnych, " +
  "w materiałach dotyczących współprac partnerskich oraz w serwisie JWK26. " +
  "Zgoda jest dobrowolna i mogę ją w każdej chwili wycofać.";

export const KLAUZULA_ZDROWIE =
  "Te informacje są dobrowolne. Służą wyłącznie przygotowaniu odpowiednich " +
  "posiłków i udzieleniu pomocy w sytuacji wyjątkowej. Widzą je tylko " +
  "organizatorzy, a ośrodek — wyłącznie dietę i alergie. Kasujemy je 14 dni " +
  "po wyjeździe. Zgodę możesz wycofać w aplikacji w każdej chwili.";

export const ZGODA_ART9 =
  "Wyrażam wyraźną zgodę na przetwarzanie podanych wyżej danych o moim zdrowiu " +
  "w celach opisanych powyżej.";

export const POTWIERDZENIE_ICE =
  "Ta osoba wie, że podaję jej numer, i zgadza się na kontakt w nagłym wypadku.";

/** Co uczestnik ma przekazać osobie ICE — organizator nie ma jak zrobić tego sam (art. 14 RODO). */
export const INFORMACJA_DLA_ICE =
  `Przekaż tej osobie: organizator JWK26 (${ADMINISTRATOR}, kontakt z IOD: ` +
  `${KONTAKT_IOD}) ma jej imię i numer telefonu wyłącznie po to, żeby ` +
  "powiadomić ją, gdyby coś Ci się stało w czasie wyjazdu. Usuniemy je 14 dni " +
  "po wyjeździe. Wcześniejszego usunięcia może zażądać, pisząc do IOD.";
