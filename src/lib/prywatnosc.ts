/**
 * Polityka prywatności aplikacji JWK26. Układ wzorowany na polityce strony
 * Dni Adaptacyjnych (ten sam administrator i IOD), zakres - na tym, co ta
 * aplikacja naprawdę zbiera (przegląd kodu i migracji z 2026-09-29).
 *
 * Nie piszemy, że ktokolwiek ten tekst zatwierdził. Zmiana treści: podbij
 * AKTUALIZACJA_POLITYKI; klauzula przy zapisach ma własną wersję (WERSJA_ZGOD).
 */
import { KOORDYNATOR_MAIL, KOORDYNATOR_TELEFON } from "@/lib/regulamin";
import { KONTAKT_IOD } from "@/lib/zapisy/zgody";

export const AKTUALIZACJA_POLITYKI = "7 października 2026 r.";

/** Akapit albo lista punktów - tyle potrzebuje ten tekst, bez własnego języka znaczników. */
export type Blok = string | { punkty: string[] };
export type SekcjaPolityki = { tytul: string; bloki: Blok[] };

export const POLITYKA: SekcjaPolityki[] = [
  {
    tytul: "Administrator danych",
    bloki: [
      "Uniwersytet Ekonomiczny we Wrocławiu, ul. Komandorska 118/120, 53-345 Wrocław.",
      `Inspektor Ochrony Danych: ${KONTAKT_IOD}.`,
      `W sprawach Jesiennego Wyjazdu Komisji 2026 (JWK26) i tej aplikacji możesz kontaktować się z koordynatorem wyjazdu: ${KOORDYNATOR_MAIL}, tel. ${KOORDYNATOR_TELEFON}. Wyjazd organizuje Samorząd Studentów Uniwersytetu Ekonomicznego we Wrocławiu.`,
    ],
  },
  {
    tytul: "Czego dotyczy ta polityka",
    bloki: [
      "Polityka opisuje przetwarzanie danych w aplikacji JWK26 dostępnej pod adresem www.jwk26.pl - przy zapisach na wyjazd i podczas zabaw integracyjnych w jego trakcie. Szczegóły dotyczące samego zgłoszenia (dane z formularza, potwierdzenie przelewu, informacje o zdrowiu, kontakt alarmowy) podaje także klauzula informacyjna wyświetlana w formularzu zapisów.",
    ],
  },
  {
    tytul: "Jakie dane, w jakim celu i na jakiej podstawie",
    bloki: [
      {
        punkty: [
          "Konto i logowanie - adres e-mail w domenie samorzad.ue.wroc.pl, a przy logowaniu kontem Google także imię i nazwisko przekazane przez Google. Cel: zalogowanie i rozpoznanie Cię w aplikacji. Podstawa: art. 6 ust. 1 lit. b RODO - korzystasz z aplikacji na własne żądanie, w związku z udziałem w wyjeździe.",
          "Zgłoszenie na wyjazd - dane z formularza zapisów, potwierdzenie przelewu i tekst z niego odczytany. Cel: kwalifikacja, organizacja wyjazdu i rozliczenie wpłaty. Podstawa: art. 6 ust. 1 lit. b RODO.",
          "Informacje o zdrowiu (dieta, alergie, choroby przewlekłe, leki) - wyłącznie jeśli je podasz. Cel: przygotowanie posiłków i pomoc w nagłej sytuacji. Podstawa: Twoja wyraźna zgoda, art. 9 ust. 2 lit. a RODO.",
          "Kontakt alarmowy (ICE) - imię, telefon i relacja osoby, którą wskażesz. Cel: powiadomienie jej, gdyby coś Ci się stało. Podstawa: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes: ochrona Twojego bezpieczeństwa).",
          "Udział w zabawach - nazwa w aplikacji, drużyna, punkty i ich historia, zdjęcia i podpisy z bingo, komentarze i polubienia, nominacje w gossipach (uzasadnienia i zdjęcia), przebieg gier w kasynie i w grze „Kruk”, zamówienia w sklepiku drużynowym. Cel: przeprowadzenie zabaw będących częścią programu wyjazdu. Podstawa: art. 6 ust. 1 lit. b RODO - udział w zabawach jest dobrowolny i następuje na Twoje żądanie.",
          "Wizerunek - zdjęcia, które Ty lub inni uczestnicy wgracie do aplikacji, widzą wyłącznie zalogowani uczestnicy i Kadra (regulamin, § 19). Rozpowszechnianie wizerunku poza aplikacją, np. w mediach społecznościowych Samorządu, odbywa się tylko na podstawie Twojej zgody (art. 6 ust. 1 lit. a RODO i art. 81 ustawy o prawie autorskim i prawach pokrewnych).",
          "Powiadomienia push - adres subskrypcji Twojego urządzenia i klucze szyfrujące. Cel: wysyłanie ogłoszeń organizatorów i informacji z zabaw. Podstawa: art. 6 ust. 1 lit. b RODO - powiadomienia włączasz sam(a) i możesz je wyłączyć w ustawieniach urządzenia.",
          "SMS-y - numer telefonu, wyłącznie jeśli wyrazisz zgodę. Cel: pilne komunikaty organizacyjne. Podstawa: zgoda, art. 6 ust. 1 lit. a RODO.",
          "Korespondencja z organizatorem - treść i dane z wiadomości lub rozmowy. Cel: odpowiedź i obsługa sprawy. Podstawa: art. 6 ust. 1 lit. f RODO.",
          "Dane techniczne - adres IP, typ urządzenia i przeglądarki, czas zapytań w dziennikach serwerów dostawców hostingu. Cel: bezpieczeństwo i usuwanie awarii. Podstawa: art. 6 ust. 1 lit. f RODO.",
        ],
      },
    ],
  },
  {
    tytul: "Kto widzi Twoje dane",
    bloki: [
      {
        punkty: [
          "Inni uczestnicy - Twoją nazwę w aplikacji, drużynę, punkty w rankingu, zdjęcia i podpisy z bingo, komentarze i polubienia. Nominacje w gossipach są dla nich anonimowe; po ujawnieniu wyniku widać tylko uzasadnienia i zdjęcia dotyczące zwycięzcy.",
          "Organizatorzy (Kadra i administratorzy aplikacji) - dane potrzebne do organizacji wyjazdu i moderacji treści. Autora nominacji mogą ustalić wyłącznie w celu reakcji na treść naruszającą regulamin.",
          "Ośrodek - wyłącznie informacje o diecie i alergiach.",
          "Podmioty przetwarzające dane na nasze zlecenie: Supabase Inc. (baza danych, logowanie, przechowywanie plików - serwery we Frankfurcie), Vercel Inc. (hosting aplikacji - funkcje uruchamiane we Frankfurcie), Google LLC / Google Ireland Ltd. (logowanie kontem Google, arkusz zgłoszeń w Google Workspace dostępny wyłącznie imiennie wskazanym organizatorom), Resend Inc. (wysyłka e-maili z kodem logowania oraz powiadomień dla organizatorów o nowych zgłoszeniach - z imieniem, nazwiskiem i turą), a po uruchomieniu SMS-ów - LINK Mobility Poland sp. z o.o. (usługa SMSAPI).",
          "Operatorzy usług push (Apple, Google, Mozilla - zależnie od Twojego urządzenia) przekazują powiadomienie na Twoje urządzenie; treść jest szyfrowana.",
        ],
      },
      "Część dostawców ma siedzibę w USA. Przekazanie danych poza Europejski Obszar Gospodarczy następuje na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską lub decyzji stwierdzającej odpowiedni stopień ochrony (EU-US Data Privacy Framework).",
    ],
  },
  {
    tytul: "Jak długo przechowujemy dane",
    bloki: [
      {
        punkty: [
          "Informacje o zdrowiu i kontakt alarmowy - usuwamy automatycznie 14 dni po zakończeniu wyjazdu.",
          "Pozostałe dane zgłoszenia, w tym potwierdzenie przelewu - do 31 grudnia 2027 r., żeby móc rozliczyć ewentualne szkody z ośrodkiem.",
          "Treści z zabaw (zdjęcia, komentarze, nominacje, historia gier, punkty i zamówienia) - do 31 stycznia 2027 r.",
          "Konto w aplikacji (adres e-mail i nazwa) - do 31 grudnia 2027 r., razem z danymi zgłoszenia, chyba że wcześniej poprosisz o jego usunięcie. Konta organizatorów usuwamy po zakończeniu ich funkcji.",
          "Subskrypcje powiadomień - do wyłączenia powiadomień, wylogowania albo wygaśnięcia subskrypcji po stronie urządzenia.",
          "Korespondencja - przez czas potrzebny do obsługi sprawy, a potem do upływu terminu przedawnienia ewentualnych roszczeń.",
        ],
      },
    ],
  },
  {
    tytul: "Twoje prawa",
    bloki: [
      "Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przenoszenia, a wobec przetwarzania na podstawie prawnie uzasadnionego interesu - prawo sprzeciwu. Zgodę na przetwarzanie informacji o zdrowiu, na wizerunek i na SMS-y możesz wycofać w każdej chwili w aplikacji (Więcej → Zarządzaj zgodami) albo mailowo u koordynatora wyjazdu; wycofanie nie wpływa na zgodność z prawem przetwarzania sprzed wycofania.",
      "Treść, którą ktoś zamieścił o Tobie w aplikacji, usuniemy na Twoje zgłoszenie do Kadry albo na adres koordynatora.",
      "Przysługuje Ci skarga do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
    ],
  },
  {
    tytul: "Jeśli ktoś wskazał Cię jako kontakt alarmowy",
    bloki: [
      `Uczestnik JWK26 podał nam Twoje imię, numer telefonu i to, kim dla niego jesteś (art. 14 RODO). Administratorem tych danych jest Uniwersytet Ekonomiczny we Wrocławiu, kontakt z Inspektorem Ochrony Danych: ${KONTAKT_IOD}. Używamy ich wyłącznie po to, żeby powiadomić Cię, gdyby temu uczestnikowi coś się stało w czasie wyjazdu - na podstawie art. 6 ust. 1 lit. f RODO. Widzą je tylko organizatorzy (także w arkuszu Google dostępnym imiennie). Usuwamy je 14 dni po zakończeniu wyjazdu. Możesz zażądać dostępu do nich, ich sprostowania lub wcześniejszego usunięcia albo wnieść sprzeciw - pisząc do IOD - a także złożyć skargę do Prezesa UODO.`,
    ],
  },
  {
    tytul: "Dobrowolność",
    bloki: [
      "Adres e-mail jest potrzebny do zalogowania, a dane z formularza zapisów - do udziału w wyjeździe (formularz oznacza, które pola są dobrowolne). Informacje o zdrowiu, kontakt alarmowy, zgoda na wizerunek i na SMS-y są dobrowolne i nie są warunkiem udziału. Udział w zabawach w aplikacji jest dobrowolny.",
    ],
  },
  {
    tytul: "Ciasteczka i pamięć urządzenia",
    bloki: [
      "Aplikacja nie używa ciasteczek reklamowych ani narzędzi analitycznych. Używa wyłącznie ciasteczek sesji, bez których nie da się pozostać zalogowanym, oraz pamięci przeglądarki na Twoim urządzeniu - np. do zapamiętania, które pola bingo już widziałeś(-aś), żeby nie odtwarzać animacji ponownie. Te informacje nie są do nas przesyłane.",
    ],
  },
  {
    tytul: "Zautomatyzowane decyzje",
    bloki: [
      "Nie profilujemy Cię i nie podejmujemy wobec Ciebie decyzji wywołujących skutki prawne w sposób zautomatyzowany. Punkty, wyniki gier i rankingi liczone są automatycznie według zasad zabaw i nie mają wartości pieniężnej (regulamin, § 19).",
    ],
  },
  {
    tytul: "Zmiany polityki",
    bloki: [
      "Aktualna wersja jest zawsze dostępna pod tym adresem, z datą ostatniej aktualizacji. O istotnych zmianach poinformujemy w aplikacji.",
    ],
  },
];
