import { SekcjaNaglowek } from "./SekcjaNaglowek";
import { Kontener } from "./Kontener";
import { ZabaStala } from "./zaba/ZabaStala";

/**
 * Czym jest JWK + pasek faktów. Cena i miejsce dochodzą do paska dopiero po
 * swoich odsłonach - przedtem „wkrótce”. Liczby miejsc celowo nie ma
 * (decyzja właściciela).
 */
export function Opis({ kwota, miasto }: { kwota: number | null; miasto: string | null }) {
  const FAKTY = [
    { etykieta: "Czas", wartosc: "3 dni" },
    { etykieta: "Cena", wartosc: kwota ? `${kwota} zł` : "wkrótce" },
    { etykieta: "Miejsce", wartosc: miasto ?? "wkrótce" },
  ];
  return (
    <section id="o-wyjezdzie" className="bg-jesien-tlo/70 mx-auto w-full scroll-mt-20 px-4 py-14">
      <Kontener>
        <SekcjaNaglowek numer="01" nadtytul="Wyjazd" tytul="Trochę o JWK…" zaba={<ZabaStala poza="opiera" skala={1} />} />
        <div className="grid gap-3 text-sm leading-relaxed text-jesien-kora">
          <p>
            Zanim rok akademicki na dobre się rozkręci, chcemy dobrze się do
            niego przygotować. JWK to coś więcej niż szkolenia - to ludzie,
            odpowiednia dawka merytoryki i zabawy. Wspomnienia z gry wyjazdowej
            czy wieczorów integracyjnych towarzyszą nam przez cały rok.
          </p>
          <p>
            Poznasz tu mnóstwo osób, z którymi zbudujesz wartościowe więzi
            i spędzisz czas w gronie samych Działaczy.
          </p>
          <p className="font-bold text-jesien-atrament">
            Nie daj się zbyt długo namawiać. Do zobaczenia na miejscu!
          </p>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-2.5">
          {FAKTY.map((f) => (
            <div key={f.etykieta} className="rounded-lg border border-jesien-kora/15 bg-jesien-karta px-3 py-3 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-jesien-rdza">{f.etykieta}</dt>
              <dd className="mt-1 font-tytul text-lg text-jesien-atrament">{f.wartosc}</dd>
            </div>
          ))}
        </dl>
      </Kontener>
    </section>
  );
}
