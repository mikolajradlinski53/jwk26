"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { komunikat } from "@/lib/zapisy/bledy";
import { bladNazwy, MOTTO_MAX, NAZWA_MAX, type StanGlosowania } from "@/lib/druzyna";

export type OsobaSkladu = { user_id: string; display_name: string | null };

/**
 * „Twoja drużyna” nad rankingiem - prowadzi przez wybór kapitana i nazwę
 * (spec 2026-10-09-druzyny-kapitan-nazwa-design.md). Po nadaniu nazwy znika.
 * Wszystkie reguły pilnuje baza; tu tylko podpowiedzi i stan.
 */
export function KartaDruzyny({
  stan,
  sklad,
  mojeId,
}: {
  stan: StanGlosowania;
  sklad: OsobaSkladu[];
  mojeId: string;
}) {
  const router = useRouter();
  const [wybrany, setWybrany] = useState<string | null>(stan.moj_glos);
  const [nazwa, setNazwa] = useState("");
  const [motto, setMotto] = useState("");
  const [potwierdzenie, setPotwierdzenie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  // Bez realtime i bez pollingu (limit żądań CDN) - gdy ktoś wraca do karty
  // (np. po przejściu do innej zakładki/apki), odświeżamy przy powrocie.
  // Na iOS PWA zakładka nie przeładowuje się sama, więc inaczej stan
  // (głos admina, zmiana kapitana) nigdy by się nie pokazał bez ręcznego
  // odświeżenia. Listener tylko wywołuje router.refresh() - żadnego
  // setState w ciele efektu.
  useEffect(() => {
    function naPowrocie() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", naPowrocie);
    return () => document.removeEventListener("visibilitychange", naPowrocie);
  }, [router]);

  if (stan.nazwa_nadana) return null;

  const imie = (id: string | null) => sklad.find((o) => o.user_id === id)?.display_name ?? "Ktoś z drużyny";
  const jestemKapitanem = stan.kapitan_id === mojeId;

  async function wywolaj(rpc: string, args: Record<string, unknown>) {
    if (wToku.current) return false;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    const { error } = await createClient().rpc(rpc, args);
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error(`${rpc} nie przeszło:`, { code: error.code, message: error.message });
      setBlad(komunikat(error));
      router.refresh();
      return false;
    }
    router.refresh();
    return true;
  }

  const ramka = "szklo mb-5 grid gap-3 rounded-md px-4 py-4";
  const naglowek = (
    <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dym">Twoja drużyna · {stan.nazwa}</p>
  );

  if (stan.etap === "nie_rozpoczete") {
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm text-kosc">Kapitana wybierzecie, gdy organizator otworzy głosowanie.</p>
        <p className="text-xs text-dym">Skład: {sklad.map((o) => o.display_name ?? "Uczestnik").join(", ")}</p>
      </section>
    );
  }

  if (stan.etap === "trwa") {
    const procent = stan.czlonkow > 0 ? Math.round((stan.glosow / stan.czlonkow) * 100) : 0;
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm font-bold text-kosc">Wybierzcie kapitana</p>
        <p className="text-xs text-dym">
          Głosowanie jest tajne i zamknie się samo, gdy zagłosuje cały skład. Na siebie też możesz głosować.
        </p>
        <fieldset className="grid gap-1.5">
          <legend className="sr-only">Kandydaci</legend>
          {sklad.map((o) => (
            <label key={o.user_id} className="flex min-h-11 items-center gap-3 text-sm text-kosc">
              <input
                type="radio"
                name="kapitan"
                checked={wybrany === o.user_id}
                onChange={() => setWybrany(o.user_id)}
                className="size-5 shrink-0 accent-[var(--color-krew)]"
              />
              <span>
                {o.display_name ?? "Uczestnik"}
                {o.user_id === mojeId && <span className="ml-1.5 text-xs text-dym">(Ty)</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          onClick={() => void wywolaj("oddaj_glos_na_kapitana", { p_kandydat: wybrany })}
          disabled={czeka || !wybrany || wybrany === stan.moj_glos}
        >
          {czeka ? "Zapisuję..." : stan.moj_glos ? "Zmień głos" : "Oddaj głos"}
        </Button>
        {stan.moj_glos && <p className="text-xs text-dym">Twój głos: {imie(stan.moj_glos)}.</p>}
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-krew-jasna transition-[width]" style={{ width: `${procent}%` }} />
          </div>
          <p className="mt-1 text-xs tabular-nums text-dym">
            Zagłosowało {stan.glosow} z {stan.czlonkow}
          </p>
        </div>
        {blad && <p role="alert" className="text-sm text-krew-jasna">{blad}</p>}
      </section>
    );
  }

  // zakonczone, nazwa nienadana
  if (!stan.kapitan_id) {
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm text-kosc">Głosowanie zakończone. Kapitana wskaże organizator.</p>
      </section>
    );
  }

  if (!jestemKapitanem) {
    return (
      <section className={ramka}>
        {naglowek}
        <p className="text-sm text-kosc">
          Kapitanem jest <b>{imie(stan.kapitan_id)}</b> - teraz wymyśla nazwę drużyny.
        </p>
      </section>
    );
  }

  const bladFormularza = bladNazwy(nazwa, motto);
  return (
    <section className={ramka}>
      {naglowek}
      <p className="text-sm font-bold text-kosc">Jesteś kapitanem - nadaj drużynie nazwę</p>
      <Field label={`Nazwa (do ${NAZWA_MAX} znaków)`} value={nazwa} maxLength={NAZWA_MAX} onChange={(e) => setNazwa(e.target.value)} />
      <Field
        label={`Motto - opcjonalnie (do ${MOTTO_MAX} znaków)`}
        value={motto}
        maxLength={MOTTO_MAX}
        onChange={(e) => setMotto(e.target.value)}
      />
      {nazwa.trim() && (
        <p className="text-xs text-dym">
          Podgląd: <b className="text-kosc">{nazwa.trim()}</b>
          {motto.trim() && <> - {motto.trim()}</>}
        </p>
      )}
      {potwierdzenie ? (
        <div className="grid gap-2">
          <p className="text-sm text-kosc">Nazwę ustawiasz raz - potem zmieni ją tylko organizator. Na pewno?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="szklo" onClick={() => setPotwierdzenie(false)} disabled={czeka}>
              Jeszcze nie
            </Button>
            <Button
              onClick={() => void wywolaj("nadaj_nazwe_druzyny", { p_nazwa: nazwa, p_motto: motto })}
              disabled={czeka || bladFormularza !== null}
            >
              {czeka ? "Zapisuję..." : "Tak, nadaj"}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setPotwierdzenie(true)} disabled={bladFormularza !== null}>
          Nadaj nazwę
        </Button>
      )}
      {blad && <p role="alert" className="text-sm text-krew-jasna">{blad}</p>}
    </section>
  );
}
