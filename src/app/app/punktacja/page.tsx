import { Ekran } from "@/components/Ekran";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { Wroc } from "@/components/Wroc";
import { PUNKTACJA } from "@/lib/punktacja";

/** Punktacja gry wyjazdowej - za co drużyna zyskuje i traci punkty. */
export default function PunktacjaPage() {
  return (
    <Ekran tytul="Punktacja" podtytul="Za co zyskujecie i tracicie">
      <p className="szklo mb-2 rounded-md px-4 py-3.5 text-sm leading-relaxed text-kosc/85">
        Punkty idą do drużyny. Pozycje „auto” liczą się same po akceptacji zdjęcia, resztę wpisuje
        Kadra. W grze terenowej wersja „cała drużyna” zastępuje zwykłą, gdy brał udział każdy z drużyny.
      </p>
      {PUNKTACJA.map((s) => (
        <section key={s.sekcja}>
          <NaglowekSekcji>{s.sekcja}</NaglowekSekcji>
          <ul className="szklo grid rounded-md px-4 py-1">
            {s.pozycje.map((p) => (
              <li
                key={p.nazwa}
                className="flex items-baseline justify-between gap-4 border-b border-white/8 py-3 last:border-b-0"
              >
                <span className="text-sm text-kosc">
                  {p.nazwa}
                  {p.automat && (
                    <span className="ml-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">auto</span>
                  )}
                  {p.doplata !== undefined && (
                    <span className="ml-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">daje Kadra</span>
                  )}
                </span>
                <span
                  className={`flex-none font-tytul text-lg leading-none tabular-nums ${
                    p.punkty < 0 ? "text-dym" : "text-krew-jasna"
                  }`}
                >
                  {p.punkty > 0 ? `+${p.punkty}` : `−${Math.abs(p.punkty)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Wroc href="/app/wiecej">Wróć</Wroc>
    </Ekran>
  );
}
