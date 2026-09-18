/**
 * Sekcja miejsca. Gdy `miejsceNazwa` albo `miejsceAdres` jest puste (awaria
 * odczytu `ustawienia()`, albo po prostu jeszcze nie uzupełnione w panelu),
 * renderuje tylko to, co ma — bez pustego nagłówka i bez łamania układu.
 * Gdy nie ma nic, sekcja znika całkiem, zamiast zostawiać martwy nagłówek
 * „Gdzie" nad pustką.
 */
export function KiedyGdzie({
  miejsceNazwa,
  miejsceAdres,
}: {
  miejsceNazwa: string | null;
  miejsceAdres: string | null;
}) {
  if (!miejsceNazwa && !miejsceAdres) return null;

  return (
    <section className="mx-auto w-full max-w-md px-4 py-10">
      <h2 className="font-tytul text-xl text-jesien-atrament">Gdzie</h2>
      <div className="mt-4 grid gap-1.5 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-5">
        {miejsceNazwa && <p className="text-sm font-bold text-jesien-atrament">{miejsceNazwa}</p>}
        {miejsceAdres && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(miejsceAdres)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-jesien-rdza underline underline-offset-2"
          >
            {miejsceAdres}
          </a>
        )}
      </div>
    </section>
  );
}
