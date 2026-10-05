import QRCode from "qrcode";

/** Dane do przelewu z app_settings - ustawiane w /app/admin/ustawienia. */
export type DanePrzelewu = {
  /** Numer rachunku w dowolnym zapisie; liczą się tylko cyfry. */
  konto: string;
  odbiorca: string;
  /** Kwota w złotych. */
  kwota: number;
  /** Numer telefonu odbiorcy (np. do BLIK-a); pusty = nie pokazujemy. */
  telefon?: string;
};

/**
 * Zdejmuje polskie znaki. Część aplikacji bankowych źle czyta je z kodu QR,
 * a tytuł „JWK26 Łucja Żak" i tak jest czytelny bez ogonków. `ł` trzeba
 * zamienić osobno - NFD go nie rozkłada, bo to osobna litera, nie „l" z akcentem.
 */
export function bezOgonkow(s: string): string {
  return s
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Tytuł przelewu „Wyjazd - Imię Nazwisko” - po nim organizator paruje wpłatę
 * ze zgłoszeniem. Bez imienia i nazwiska samo „Wyjazd”.
 */
export function tytulPrzelewu(imie: string, nazwisko: string): string {
  const kto = [imie.trim(), nazwisko.trim()].filter(Boolean).join(" ");
  return kto ? `Wyjazd - ${kto}` : "Wyjazd";
}

export function cyfry(konto: string): string {
  return konto.replace(/\D/g, "");
}

/** Polski rachunek w NRB: 26 cyfr, z „PL" albo bez, ze spacjami albo bez. */
export function kontoPoprawne(konto: string): boolean {
  return cyfry(konto).length === 26;
}

/** Zapis bankowy: dwie cyfry kontrolne, potem grupy po cztery. */
export function kontoCzytelne(konto: string): string {
  const c = cyfry(konto);
  return [c.slice(0, 2), ...(c.slice(2).match(/.{1,4}/g) ?? [])].join(" ");
}

/**
 * Treść kodu QR według rekomendacji ZBP, którą czytają polskie aplikacje
 * bankowe: `NIP|kraj|rachunek|kwota|odbiorca|tytuł|rezerwa|rezerwa|rezerwa`.
 * NIP pusty (odbiorca to nie firma), kwota w groszach na sześciu cyfrach,
 * odbiorca do 20 znaków, tytuł do 32. `|` z treści zamieniamy na spację,
 * bo inaczej przesunąłby wszystkie kolejne pola.
 */
export function ladunekQr(dane: DanePrzelewu, tytul: string): string {
  const pole = (s: string, max: number) =>
    bezOgonkow(s).replace(/\|/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const grosze = String(Math.round(dane.kwota * 100)).padStart(6, "0");
  return ["", "PL", cyfry(dane.konto), grosze, pole(dane.odbiorca, 20), pole(tytul, 32), "", "", ""].join(
    "|",
  );
}

/**
 * Moduły kodu jako jedna ścieżka SVG. Synchronicznie i bez efektów, więc
 * liczy się w renderze po obu stronach - bez `useEffect` + `setState`, które
 * lint w tej wersji Reacta odrzuca, i bez mignięcia pustego kwadratu.
 */
export function sciezkaQr(tekst: string): { rozmiar: number; d: string } {
  const qr = QRCode.create(tekst, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let wiersz = 0; wiersz < n; wiersz++) {
    for (let kolumna = 0; kolumna < n; kolumna++) {
      if (qr.modules.get(wiersz, kolumna)) d += `M${kolumna} ${wiersz}h1v1h-1z`;
    }
  }
  return { rozmiar: n, d };
}
