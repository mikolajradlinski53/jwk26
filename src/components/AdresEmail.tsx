/**
 * Adres e-mail, który na wąskim ekranie łamie się po „@”, a nie w środku
 * słowa („…@samorzad.ue.wr / oc.pl” przy `break-all`). `select-all` - jedno
 * stuknięcie zaznacza cały adres do skopiowania ręcznie.
 */
export function AdresEmail({ adres, className = "" }: { adres: string; className?: string }) {
  const at = adres.indexOf("@");
  if (at < 0) return <span className={`select-all ${className}`}>{adres}</span>;
  return (
    <span className={`min-w-0 select-all [overflow-wrap:anywhere] ${className}`}>
      {adres.slice(0, at + 1)}
      <wbr />
      {adres.slice(at + 1)}
    </span>
  );
}
