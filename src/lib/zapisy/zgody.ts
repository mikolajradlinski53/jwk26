/**
 * Teksty prawne formularza zapisów. Jedno miejsce, jedna wersja.
 *
 * Każda zmiana treści wymaga podbicia WERSJA_ZGOD - zgłoszenie zapisuje wersję,
 * którą uczestnik zobaczył, i tylko po niej da się potem ustalić, na co się
 * zgodził. Baza tego nie wyłapie; to reguła przeglądu kodu (D8 speca).
 *
 * Wersja 2026-09-28 dopisuje do klauzuli dwa nowe pola: zwolnienie
 * rektorskie (z godzinami) i odpowiedź na pytanie o alkohol. Wersja
 * 2026-09-28.2 dopisuje Google (arkusz zespołu) jako podmiot przetwarzający.
 *
 * 2026-09-29.1 wprowadza pełny regulamin (§ 1-22) i oświadczenie o szkodach
 * bez odpowiedzialności solidarnej za pokój. 2026-09-29.2 - § 19 mówi
 * o nominacjach (ze zdjęciami) zamiast o głosowaniach. 2026-09-29.3 -
 * zgody z kanałami i adresatem (wizerunek, art. 9, SMS), pełniejsza
 * informacja dla ICE, Resend i SMSAPI wśród odbiorców, odesłanie do polityki.
 *
 * Zmiana treści regulaminu (src/lib/regulamin.ts) też wymaga podbicia
 * WERSJA_ZGOD, bo strona regulaminu pokazuje tę wersję.
 *
 * 2026-09-29.4 - wszędzie zwykłe myślniki zamiast długich (bez zmian treści).
 * 2026-10-05.1 - regulamin § 3 ust. 5: brak potwierdzenia wpłaty = odrzucenie;
 *                Resend wysyła też powiadomienia organizatorom o zgłoszeniach.
 */
export const WERSJA_ZGOD = "2026-10-05.1";

export const KONTAKT_IOD = "iod@ue.wroc.pl";

const ADMINISTRATOR =
  "Uniwersytet Ekonomiczny we Wrocławiu, ul. Komandorska 118/120, 53-345 Wrocław";

/** Klauzula informacyjna z art. 13 RODO - akapit na element. */
export const KLAUZULA_INFORMACYJNA: string[] = [
  `Administratorem Twoich danych osobowych jest ${ADMINISTRATOR}. ` +
    `Z Inspektorem Ochrony Danych skontaktujesz się pod adresem ${KONTAKT_IOD}.`,
  "Imię, nazwisko, numer indeksu, datę urodzenia, telefon, sposób dojazdu " +
    "i podpis na identyfikatorze przetwarzamy, żeby zorganizować Jesienny " +
    "Wyjazd Komisji 2026 (JWK26), na podstawie art. 6 ust. 1 lit. b RODO - " +
    "bierzesz w nim udział na własny wniosek. Datę urodzenia wykorzystujemy " +
    "także do sprawdzenia, czy w dniu wyjazdu masz ukończone 18 lat. Na tej " +
    "samej podstawie przetwarzamy informację, czy i w jakich godzinach " +
    "potrzebujesz zwolnienia rektorskiego na 23 października 2026 roku (żeby " +
    "je dla Ciebie załatwić), oraz odpowiedź na pytanie o alkohol (żeby " +
    "zaplanować zakupy i program) - jeśli zdecydujesz się je podać.",
  "Adres e-mail, którym logujesz się do aplikacji, oraz zdjęcie potwierdzenia " +
    "przelewu razem z odczytanym z niego tekstem przetwarzamy, żeby potwierdzić " +
    "Twój udział i rozliczyć wpłatę - na podstawie art. 6 ust. 1 lit. b RODO.",
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
    "o prawie autorskim i prawach pokrewnych). Numer telefonu do SMS-ów " +
    "z komunikatami organizacyjnymi wykorzystujemy wyłącznie na podstawie " +
    "Twojej zgody (art. 6 ust. 1 lit. a RODO).",
  "Dane widzą organizatorzy wyjazdu. Ośrodek otrzymuje wyłącznie informacje " +
    "o diecie i alergiach. Dane są przechowywane u dostawców infrastruktury " +
    "(Supabase, Vercel), którzy przetwarzają je na nasze zlecenie; e-maile " +
    "z kodem logowania i powiadomienia organizatorów o nowych zgłoszeniach " +
    "(imię, nazwisko, tura) wysyła Resend, a SMS-y - jeśli się na nie zgodzisz - " +
    "operator usługi SMSAPI (LINK Mobility Poland). Listę zgłoszeń " +
    "- łącznie z informacjami o diecie, alergiach, chorobach, lekach i kontakcie " +
    "ICE - prowadzimy też w arkuszu Google (Google Workspace), do którego dostęp " +
    "mają wyłącznie imiennie wskazani organizatorzy; Google przetwarza te dane na " +
    "nasze zlecenie, a arkusz odświeża się z aplikacji, więc usunięcie danych " +
    "w aplikacji usuwa je też z arkusza. Dostawcy ci " +
    "mogą przetwarzać dane także poza Europejskim Obszarem Gospodarczym - " +
    "wyłącznie na podstawie standardowych klauzul umownych zatwierdzonych " +
    "przez Komisję Europejską.",
  "Informacje o zdrowiu i dane osoby ICE usuwamy 14 dni po zakończeniu " +
    "wyjazdu. Pozostałe dane ze zgłoszenia, w tym zdjęcie potwierdzenia " +
    "przelewu, przechowujemy do 31 grudnia 2027 roku, żeby móc rozliczyć " +
    "ewentualne szkody z ośrodkiem.",
  "Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, " +
    "ograniczenia przetwarzania i wniesienia sprzeciwu, a także prawo " +
    "wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych. Każdą zgodę " +
    "możesz wycofać w dowolnym momencie w aplikacji; wycofanie nie wpływa na " +
    "zgodność z prawem przetwarzania sprzed wycofania.",
  "Podanie danych z kroków „Dane” i „O tobie” jest warunkiem udziału " +
    "w wyjeździe, z wyjątkiem zwolnienia rektorskiego i pytania o alkohol. " +
    "Te dwie odpowiedzi, kontakt ICE, informacje o zdrowiu, zgoda na " +
    "wizerunek i na SMS-y są dobrowolne - bez nich też pojedziesz.",
  "Jak przetwarzamy dane podczas korzystania z aplikacji (zdjęcia, " +
    "komentarze, nominacje, gry, powiadomienia), opisuje polityka prywatności: " +
    "www.jwk26.pl/prywatnosc.",
];

// Bez odpowiedzialności solidarnej za pokój: regulamin § 13 ust. 4 wprost ją
// wyklucza, a oświadczenie nie może być surowsze niż regulamin, do którego
// odsyła. Roszczenia zgłasza podmiot uprawniony (§ 13 ust. 6), nie Kadra.
export const OSWIADCZENIE_SZKODY =
  "Oświadczam, że zapoznałem(-am) się z § 13 Regulaminu i przyjmuję do " +
  "wiadomości, że odpowiadam za szkody w mieniu Obiektu lub innych osób " +
  "wyrządzone przeze mnie w czasie Wydarzenia, na zasadach określonych " +
  "w przepisach prawa. Zobowiązuję się niezwłocznie zgłaszać obsłudze Obiektu " +
  "i Kadrze szkody, które spowodowałem(-am) lub zauważyłem(-am), oraz " +
  "współdziałać przy ich dokumentowaniu.";

// Kanały nazwane wprost - „materiały promocyjne” bez adresata zgody i bez
// kanałów to zgoda, której zakresu nie da się potem wykazać. Zdjęcia
// w samej aplikacji (widoczne tylko dla uczestników) reguluje regulamin § 19.
export const ZGODA_WIZERUNEK =
  "Zgadzam się, żeby Uniwersytet Ekonomiczny we Wrocławiu (Samorząd Studentów " +
  "UEW) nieodpłatnie rozpowszechniał mój wizerunek utrwalony na zdjęciach " +
  "i nagraniach z JWK26 - w mediach społecznościowych i na stronach " +
  "internetowych Samorządu Studentów UEW oraz w jego materiałach informacyjnych " +
  "i promocyjnych, także dotyczących współpracy z partnerami. Zgoda jest " +
  "dobrowolna, nie jest warunkiem udziału i mogę ją w każdej chwili wycofać " +
  "w aplikacji (Więcej → Twoje zgody); wycofanie nie wpływa na materiały " +
  "rozpowszechnione wcześniej.";

export const KLAUZULA_ZDROWIE =
  "Te informacje są dobrowolne i nie są warunkiem udziału. Służą wyłącznie " +
  "przygotowaniu odpowiednich posiłków i udzieleniu Ci pomocy w nagłej " +
  "sytuacji. Widzą je tylko organizatorzy, a ośrodek - wyłącznie dietę " +
  "i alergie. Usuwamy je automatycznie 14 dni po wyjeździe. Zgodę możesz " +
  "wycofać w aplikacji w każdej chwili - wtedy od razu je kasujemy.";

export const ZGODA_ART9 =
  "Wyrażam wyraźną zgodę na przetwarzanie przez Uniwersytet Ekonomiczny " +
  "we Wrocławiu podanych wyżej informacji o moim zdrowiu (dieta, alergie, " +
  "choroby przewlekłe, przyjmowane leki) w celu przygotowania posiłków " +
  "i udzielenia mi pomocy w nagłej sytuacji podczas JWK26 (art. 9 ust. 2 " +
  "lit. a RODO).";

export const ZGODA_SMS =
  "Zgadzam się na otrzymywanie na podany numer SMS-ów z pilnymi komunikatami " +
  "organizacyjnymi JWK26 (dobrowolnie, mogę wycofać w aplikacji).";

export const POTWIERDZENIE_ICE =
  "Ta osoba wie, że podaję jej numer, i zgadza się na kontakt w nagłym wypadku.";

/**
 * Co uczestnik ma przekazać osobie ICE (art. 14 RODO). Organizator nie ma jak
 * zrobić tego sam przed wyjazdem, więc pełna informacja leży też publicznie
 * w polityce prywatności - tu jest jej skrót z adresem.
 */
export const INFORMACJA_DLA_ICE =
  `Przekaż tej osobie: administrator danych (${ADMINISTRATOR}, kontakt z IOD: ` +
  `${KONTAKT_IOD}) ma jej imię, numer telefonu i informację, kim dla Ciebie ` +
  "jest, wyłącznie po to, żeby ją powiadomić, gdyby coś Ci się stało w czasie " +
  "wyjazdu. Widzą je tylko organizatorzy; usuniemy je 14 dni po wyjeździe. " +
  "Może zażądać dostępu do nich, sprostowania, wcześniejszego usunięcia albo " +
  "wnieść sprzeciw - pisząc do IOD. Pełna informacja: www.jwk26.pl/prywatnosc.";
