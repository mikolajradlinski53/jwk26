/** Treść błędu dowolnego kształtu - PostgrestError bywa zwykłym obiektem. */
export function tekstBledu(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

/**
 * Błąd techniczny → zdanie, z którym da się coś zrobić. Surowy komunikat
 * zostaje w konsoli; na telefonie, po ciemku, „duplicate key value" nie pomaga.
 */
export function komunikat(e: unknown): string {
  const t = tekstBledu(e);

  if (/PULA_PELNA/.test(t)) return "Ta pula właśnie się zapełniła.";
  if (/PDF_ZA_DUZY/.test(t)) return "Ten PDF ma ponad 5 MB. Zrób zrzut ekranu potwierdzenia i wyślij go zamiast pliku.";
  if (/PULA_ZAMKNIETA/.test(t)) {
    return "Ta tura jest zamknięta. Wróć do pierwszego kroku i sprawdź, które są otwarte.";
  }
  if (/FORMULARZ_NIEAKTUALNY/.test(t)) {
    return "Formularz właśnie się zmienił - odśwież stronę i wypełnij zwolnienie jeszcze raz.";
  }
  if (/nieznany przedzial godzin/.test(t)) return "Zaznacz przedziały zwolnienia z listy.";
  if (/TURA_TYLKO_SAMORZAD/.test(t)) {
    return "Z prywatnego maila zapiszesz się tylko do tury Świeżaków. Działacze i Alumni - zaloguj się kontem @samorzad.ue.wroc.pl.";
  }
  if (/PRZELEW_WYMAGANY/.test(t)) return "W tej puli zwolniło się miejsce - dołącz potwierdzenie przelewu.";
  if (/NIEPELNOLETNI/.test(t)) {
    return "Na JWK26 jadą osoby, które w dniu wyjazdu mają skończone 18 lat.";
  }
  if (/REGULAMIN_ROBOCZY/.test(t)) return "Najpierw oznacz regulamin jako zatwierdzony.";
  if (/raz na minute/i.test(t)) return "Próbne powiadomienie możesz wysłać raz na minutę.";
  // Drużyny
  if (/NAZWA_ZAJETA/.test(t)) return "Ta nazwa jest już zajęta przez inną drużynę.";
  if (/NAZWA_JUZ_NADANA/.test(t)) return "Drużyna już ma nazwę - zmienić ją może tylko Organizator.";
  if (/NAZWA_DLUGOSC/.test(t)) return "Nazwa ma od 1 do 30 znaków.";
  if (/MOTTO_DLUGOSC/.test(t)) return "Motto ma najwyżej 60 znaków.";
  if (/Glosowanie nie trwa/.test(t)) return "Głosowanie nie trwa - odśwież ekran.";
  if (/Kandydat spoza/.test(t)) return "Ta osoba nie jest w Twojej drużynie.";
  if (/Nazwe nadaje kapitan/.test(t)) return "Nazwę nadaje kapitan drużyny - odśwież ekran.";
  // Kasyno
  const stawka = t.match(/Masz (-?\d+) pkt, a stawka to (\d+)/);
  if (stawka) return `Masz ${stawka[1]} pkt, a stawka to ${stawka[2]}.`;
  const limit = t.match(/Limit obrotu wyczerpany: (\d+) z (\d+)/);
  if (limit)
    return limit[2] === "0"
      ? "Twoja drużyna nie miała jeszcze punktów na początku tego okna, więc pula kasyna jest pusta. Nowa pula o 12:00 i o północy."
      : `Pula kasyna na te 12 h wyczerpana: postawiono ${limit[1]} z ${limit[2]} pkt. Nowa pula o 12:00 i o północy.`;
  if (/Kadra nie bierze udzialu w klatwach/i.test(t)) return "Kadra nie rzuca klątw - te zostają między drużynami uczestników.";
  if (/Do Kadry trafiaja tylko admini/i.test(t)) return "Do Kadry trafiają tylko Organizatorzy.";
  if (/reke w toku/i.test(t)) return "Masz rękę w toku - dokończ ją.";
  if (/Brak reki w toku/i.test(t)) return "Ta ręka jest już rozstrzygnięta.";
  if (/Podwoic mozna/i.test(t)) return "Podwoić można tylko przy 9, 10 albo 11 na dwóch pierwszych kartach.";
  if (/Stawka to 10, 20 albo 50/i.test(t)) return "Stawka to 10, 20 albo 50 pkt.";
  if (/zaakceptowani uczestnicy/i.test(t)) return "Grać mogą tylko przyjęci uczestnicy.";
  // Kasyno na żetonach (po gali)
  if (/Za malo zetonow na to wyzwanie/i.test(t)) return "Masz za mało żetonów, żeby przyjąć to wyzwanie.";
  if (/Za malo zetonow/i.test(t)) return "Masz za mało żetonów.";
  if (/Masz jeszcze zetony/i.test(t)) return "Masz jeszcze żetony na grę - dokładka jest dopiero, gdy nie starcza na stawkę 10.";
  if (/Stawka od 10 do 500/i.test(t)) return "Stawka wyzwania to od 10 do 500 żetonów.";
  if (/3 wyzwania bez odpowiedzi/i.test(t)) return "Masz już 3 wyzwania bez odpowiedzi - poczekaj albo anuluj któreś.";
  if (/samego siebie/i.test(t)) return "Nie możesz wyzwać samego siebie.";
  if (/nie czeka na Ciebie|juz nieaktualne|Nie mozna zamknac/i.test(t)) return "To wyzwanie jest już nieaktualne - lista jest odświeżona.";
  if (/Wyzwania niedostepne|Dokladka niedostepna/i.test(t)) return "Kasyno nie gra teraz na żetonach.";
  // Kruk
  if (/Nie ma takiej gry/i.test(t)) return "Ta gra już nie istnieje - zacznij nowy lot.";
  if (/juz zapisany/i.test(t)) return "Wynik tego lotu jest już zapisany.";
  if (/niemozliwy w tym czasie/i.test(t)) return "Serwer nie uznał tego wyniku.";
  // Gossipy
  if (/nominowac siebie/i.test(t)) return "Nie możesz nominować siebie.";
  if (/juz oddana/i.test(t)) return "Dzisiejsza nominacja w tej kategorii jest już oddana - kolejną oddasz jutro.";
  if (/nie jest otwarta/i.test(t)) return "Nominacje w tej kategorii są już zamknięte.";
  if (/przyjetego uczestnika/i.test(t)) return "Tej osoby nie ma wśród przyjętych uczestników.";
  if (/Nieprawidlowe zdjecie/i.test(t)) return "Zdjęcie nie dotarło. Wybierz je jeszcze raz.";
  const minimum = t.match(/co najmniej (\d+) znakow/i);
  if (minimum) return `Uzasadnienie musi mieć co najmniej ${minimum[1]} znaków.`;
  if (/one_pending|duplicate key/i.test(t)) {
    return "Masz już zgłoszenie, które czeka na rozpatrzenie.";
  }
  if (/juz zaakceptowane/i.test(t)) return "Twoje zgłoszenie jest już przyjęte.";
  if (/DRUZYNA_PELNA/.test(t)) return "Ta drużyna ma już komplet - wybierz inną.";
  // Dwóch adminów nad jednym zgłoszeniem - drugi przegrywa blokadę wiersza.
  if (/zostalo juz rozpatrzone/i.test(t)) return "To zgłoszenie ktoś właśnie rozpatrzył - lista jest odświeżona.";
  if (/wolnego miejsca/i.test(t)) {
    return "W tej puli nie ma wolnego miejsca. Zwiększ liczbę miejsc albo najpierw kogoś odrzuć.";
  }
  if (/jwt|expired|401|Brak sesji/i.test(t)) {
    return "Sesja wygasła. Zaloguj się ponownie.";
  }
  if (/mime type|not supported/i.test(t)) {
    return "Ten format zdjęcia nie przechodzi. Zrób zrzut ekranu i spróbuj ponownie.";
  }
  if (/failed to fetch|networkerror|network|load failed/i.test(t)) {
    return "Zerwało połączenie. Sprawdź zasięg i spróbuj jeszcze raz.";
  }
  if (/image|decode|canvas/i.test(t)) {
    return "Nie udało się odczytać tego pliku jako zdjęcia. Spróbuj innego.";
  }
  return "Coś poszło nie tak. Spróbuj jeszcze raz.";
}
