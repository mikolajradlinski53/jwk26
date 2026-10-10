import { Ekran } from "@/components/Ekran";
import { Button } from "@/components/ui/Button";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import { Powiadomienia } from "@/components/Powiadomienia";
import { LicznikOdslony } from "@/app/landing/LicznikOdslony";
import { odliczanie } from "@/lib/odliczanie";
import { kiedyOdslona, tekstOdliczania } from "@/lib/odslony";

/**
 * Ekran przyjętego uczestnika przed otwarciem platformy (`otwarcie_platformy`
 * w panelu). Licznik na zerze prosi serwer o nową wersję - layout wtedy
 * zamiast poczekalni wyrenderuje apkę. Odświeżenie przy powrocie, bo PWA na
 * iOS nie przeładowuje strony: kto zamknął apkę przed otwarciem, po powrocie
 * zostałby w poczekalni na zawsze.
 */
export function Poczekalnia({ otwarcie }: { otwarcie: string }) {
  const poczatkowy = tekstOdliczania(odliczanie(otwarcie, new Date()));

  return (
    <Ekran tytul="Brama jeszcze zamknięta" podtytul="Zgłoszenie przyjęte - platforma otworzy się dla wszystkich naraz">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public, bez optymalizacji */}
        <img
          src="/grafika/poczekalnia.webp"
          alt=""
          width={332}
          height={600}
          className="h-[min(42dvh,300px)] w-auto drop-shadow-[0_0_30px_rgb(200_16_46/0.25)]"
        />
        <div className="szklo w-full rounded-md px-4 py-4">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dym">
            Otwarcie {kiedyOdslona(otwarcie)}
          </p>
          <LicznikOdslony
            data={otwarcie}
            poczatkowy={poczatkowy}
            className="mt-1.5 block text-[1.9rem] leading-tight text-kosc"
          />
          <span className="sr-only">Platforma otworzy się {kiedyOdslona(otwarcie)}.</span>
        </div>
        <p className="text-sm leading-relaxed text-dym">
          Masz miejsce na wyjeździe. Ranking, bingo i reszta ruszą o tej godzinie - nie musisz
          nic odświeżać, ekran sam się otworzy.
        </p>
      </div>

      <Powiadomienia />
      <OdswiezPrzyPowrocie />

      <form action="/auth/signout" method="post" className="mt-10">
        <Button variant="cichy" type="submit" className="w-full">
          Wyloguj
        </Button>
      </form>
    </Ekran>
  );
}
