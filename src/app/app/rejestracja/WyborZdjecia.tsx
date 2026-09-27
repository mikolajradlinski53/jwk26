"use client";

export function WyborZdjecia({
  plik,
  blad,
  disabled,
  onWybor,
}: {
  plik: File | null;
  blad: string | null;
  disabled?: boolean;
  onWybor: (plik: File | null) => void;
}) {
  return (
    <div className="grid gap-3">
      <label className="block">
        <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
          Potwierdzenie przelewu
        </span>
        <input
          type="file"
          accept="image/*"
          // `capture` podpowiada aparat zamiast galerii — większość osób i tak
          // robi zdjęcie ekranu bankowości w momencie wypełniania.
          capture="environment"
          aria-invalid={blad ? true : undefined}
          disabled={disabled}
          onChange={(e) => onWybor(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-dym
                     file:mr-3 file:min-h-11 file:rounded-full file:border-0
                     file:bg-krew file:px-4 file:text-xs file:font-bold file:text-white"
        />
        {plik && (
          <span className="mt-1.5 block text-sm text-dym">
            {plik.name} ({Math.round(plik.size / 1024)} kB)
          </span>
        )}
        {blad && (
          <span role="alert" className="mt-1.5 block text-sm text-krew-jasna">
            {blad}
          </span>
        )}
      </label>
      <p className="text-xs leading-relaxed text-dym">
        Odczyt przelewu dzieje się na twoim telefonie i może chwilę potrwać.
        Zdjęcie widzi wyłącznie organizator.
      </p>
    </div>
  );
}
