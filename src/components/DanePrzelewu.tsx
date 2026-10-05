import { KopiujMaly } from "@/components/KopiujMaly";
import {
  cyfry,
  kontoCzytelne,
  ladunekQr,
  sciezkaQr,
  type DanePrzelewu as Dane,
} from "@/lib/zapisy/qrPrzelewu";

const STYLE = {
  // Apka: ciemne szkło.
  noc: {
    ramka: "szklo rounded-md px-4 py-4",
    etykieta: "text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym",
    wartosc: "text-sm text-kosc",
    przypis: "text-xs leading-relaxed text-dym",
  },
  // Landing: jasna jesień, ta sama karta co reszta sekcji „Cena i wpłata".
  jesien: {
    ramka: "rounded-lg border-2 border-dashed border-jesien-dynia/60 bg-jesien-tlo/70 p-5",
    etykieta: "text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza",
    wartosc: "text-sm text-jesien-atrament",
    przypis: "text-xs leading-relaxed text-jesien-kora",
  },
} as const;

/**
 * Dane do przelewu z kodem QR w formacie ZBP - po zeskanowaniu w aplikacji
 * banku numer konta, kwota, odbiorca i tytuł wpisują się same. Ręczne
 * przepisywanie 26 cyfr na telefonie to najczęstsze źródło przelewów, których
 * organizator potem nie umie sparować.
 *
 * Bez dyrektywy „use client": komponent nie ma stanu, więc renderuje się
 * i na serwerze (landing), i w formularzu po stronie klienta. Kod QR liczy się
 * synchronicznie w renderze.
 */
export function DanePrzelewu({
  dane,
  tytul,
  tytulQr = tytul,
  wariant = "noc",
  przypisTytulu,
}: {
  dane: Dane | null;
  tytul: string;
  /** Tytuł w kodzie QR, gdy na ekranie stoi wzór do uzupełnienia (landing). */
  tytulQr?: string;
  wariant?: keyof typeof STYLE;
  /** Dopisek pod tytułem, np. na landingu, gdzie nie znamy imienia. */
  przypisTytulu?: string;
}) {
  const s = STYLE[wariant];

  if (!dane) {
    return (
      <div className={s.ramka}>
        <p className={s.etykieta}>Dane do przelewu</p>
        <p className={`mt-2 ${s.przypis}`}>
          Numer konta i kod QR pojawią się tutaj, gdy tylko organizator je poda.
        </p>
      </div>
    );
  }

  const { rozmiar, d } = sciezkaQr(ladunekQr(dane, tytulQr));

  return (
    <div className={`${s.ramka} grid gap-4`}>
      <p className={s.etykieta}>Dane do przelewu</p>

      <div className="flex flex-col items-center gap-4 min-[500px]:flex-row min-[500px]:items-start">
        {/* Czarne na białym niezależnie od motywu: skanery banków źle czytają
            kod w odwróconych kolorach, a margines (quiet zone) to wymóg standardu. */}
        <svg
          viewBox={`-4 -4 ${rozmiar + 8} ${rozmiar + 8}`}
          role="img"
          aria-label="Kod QR przelewu - zeskanuj w aplikacji banku"
          shapeRendering="crispEdges"
          className="size-44 shrink-0 rounded-md bg-white"
        >
          <path d={d} fill="#000" />
        </svg>

        <dl className="grid w-full gap-3">
          <div>
            <dt className={s.przypis}>Kwota</dt>
            <dd className={`${s.wartosc} font-bold`}>{dane.kwota} zł</dd>
          </div>
          <div>
            <dt className={s.przypis}>Odbiorca</dt>
            <dd className={s.wartosc}>{dane.odbiorca}</dd>
          </div>
          <div>
            <dt className={s.przypis}>Numer konta</dt>
            <dd className={`flex items-center justify-between gap-3 ${s.wartosc}`}>
              <span className="tabular-nums">{kontoCzytelne(dane.konto)}</span>
              <KopiujMaly tekst={cyfry(dane.konto)} co="numer konta" />
            </dd>
          </div>
          {dane.telefon && (
            <div>
              <dt className={s.przypis}>Numer telefonu</dt>
              <dd className={`flex items-center justify-between gap-3 ${s.wartosc}`}>
                <span className="tabular-nums">{dane.telefon}</span>
                <KopiujMaly tekst={dane.telefon.replace(/\s/g, "")} co="numer telefonu" />
              </dd>
            </div>
          )}
          <div>
            <dt className={s.przypis}>Tytuł przelewu</dt>
            <dd className={`flex items-center justify-between gap-3 ${s.wartosc}`}>
              <span className="break-words">{tytul}</span>
              <KopiujMaly tekst={tytul} co="tytuł przelewu" />
            </dd>
            {przypisTytulu && <p className={`mt-1 ${s.przypis}`}>{przypisTytulu}</p>}
          </div>
        </dl>
      </div>

      <p className={s.przypis}>
        Zeskanuj kod w aplikacji banku - numer konta, kwota i tytuł wpiszą się same.
      </p>
    </div>
  );
}
