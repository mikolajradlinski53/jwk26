/** Treść błędu dowolnego kształtu — PostgrestError bywa zwykłym obiektem. */
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
  if (/PULA_ZAMKNIETA/.test(t)) {
    return "Ta tura jest zamknięta. Wróć do pierwszego kroku i sprawdź, które są otwarte.";
  }
  if (/PRZELEW_WYMAGANY/.test(t)) return "W tej puli zwolniło się miejsce — dołącz potwierdzenie przelewu.";
  if (/NIEPELNOLETNI/.test(t)) {
    return "Na JWK26 jadą osoby, które w dniu wyjazdu mają skończone 18 lat.";
  }
  if (/REGULAMIN_ROBOCZY/.test(t)) return "Najpierw oznacz regulamin jako zatwierdzony.";
  if (/raz na minute/i.test(t)) return "Próbne powiadomienie możesz wysłać raz na minutę.";
  // Kasyno
  const stawka = t.match(/Masz (-?\d+) pkt, a stawka to (\d+)/);
  if (stawka) return `Masz ${stawka[1]} pkt, a stawka to ${stawka[2]}.`;
  const limit = t.match(/Limit obrotu wyczerpany: (\d+) z (\d+)/);
  if (limit) return `Dzienny limit kasyna wyczerpany: ${limit[1]} z ${limit[2]} pkt w ostatnich 24 h.`;
  if (/reke w toku/i.test(t)) return "Masz rękę w toku — dokończ ją.";
  if (/Brak reki w toku/i.test(t)) return "Ta ręka jest już rozstrzygnięta.";
  if (/Podwoic mozna/i.test(t)) return "Podwoić można tylko przy 9, 10 albo 11 na dwóch pierwszych kartach.";
  if (/Stawka to 10, 20 albo 50/i.test(t)) return "Stawka to 10, 20 albo 50 pkt.";
  // Gossipy
  if (/na siebie/i.test(t)) return "Nie możesz głosować na siebie.";
  if (/juz oddany/i.test(t)) return "Twój głos w tej kategorii jest już oddany.";
  if (/nie jest otwarta/i.test(t)) return "Głosowanie w tej kategorii jest już zamknięte.";
  const minimum = t.match(/co najmniej (\d+) znakow/i);
  if (minimum) return `Uzasadnienie musi mieć co najmniej ${minimum[1]} znaków.`;
  if (/od 2 do 8/i.test(t)) return "Wybierz od 2 do 8 nominowanych spośród przyjętych uczestników.";
  if (/one_pending|duplicate key/i.test(t)) {
    return "Masz już zgłoszenie, które czeka na rozpatrzenie.";
  }
  if (/juz zaakceptowane/i.test(t)) return "Twoje zgłoszenie jest już przyjęte.";
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
