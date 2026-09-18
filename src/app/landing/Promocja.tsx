/**
 * Miejsce na zdjęcia i filmy z wyjazdu — materiały jeszcze nie istnieją,
 * właściciel dopiero je nagra. Zamiast obrazków zastępczych z zewnętrznych
 * serwisów (i tak zablokowanych tutaj) sekcja pokazuje krótką zapowiedź,
 * żeby pusty stan wyglądał jak świadoma decyzja, nie jak usterka.
 */
export function Promocja() {
  return (
    <section id="promocja" className="mx-auto w-full max-w-md scroll-mt-20 px-4 py-10">
      <h2 className="font-tytul text-xl text-jesien-atrament">Zapowiedź</h2>
      <div className="mt-4 rounded-lg border border-jesien-kora/15 bg-jesien-karta p-8 text-center">
        <p className="text-sm text-jesien-kora">
          Zdjęcia i filmy z zapowiedzią wyjazdu pojawią się tutaj, gdy tylko
          powstaną.
        </p>
      </div>
    </section>
  );
}
