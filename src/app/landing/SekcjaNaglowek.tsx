/**
 * Nagłówek sekcji powtarzany na całym landingu: duży wyblakły numer,
 * krótki nadtytuł wersalikami w `jesien-rdza` (rozstrzelone litery przez
 * `tracking-[0.24em]`) i właściwy tytuł sekcji w `font-tytul`.
 *
 * To jest główne narzędzie "wyraźnego podziału" z brifu — każda sekcja
 * zaczyna się tym samym rytmem, więc granice między nimi czyta się od razu,
 * nawet zanim dotrze się do naprzemiennego tła czy dzielnika.
 *
 * `zaba` — poza żaby-przewodnika dla tej sekcji, po prawej stronie nagłówka
 * (stopy na linii tytułu). Własny wiersz, więc nie wchodzi na tekst sekcji.
 */
export function SekcjaNaglowek({
  numer,
  nadtytul,
  tytul,
  zaba,
}: {
  numer: string;
  nadtytul: string;
  tytul: string;
  zaba?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="select-none font-tytul text-3xl leading-none text-jesien-rdza/25 min-[600px]:text-4xl"
        >
          {numer}
        </span>
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-jesien-rdza">
            {nadtytul}
          </p>
          <h2 className="mt-1 font-tytul text-xl text-jesien-atrament min-[600px]:text-2xl">
            {tytul}
          </h2>
        </div>
      </div>
      {zaba && <div className="-mb-1 flex-none">{zaba}</div>}
    </div>
  );
}
