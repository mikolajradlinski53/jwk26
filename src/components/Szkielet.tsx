import { ViewTransition } from "react";
import { RUCH } from "./Ekran";

/**
 * Szkielety ekranów na czas, gdy serwer składa nowy (`loading.tsx`).
 * Każda strona ma własny: prawdziwy tytuł i kształty jak jej docelowy układ,
 * żeby podmiana na treść nie była skokiem w inny świat (uwaga Mikołaja:
 * jedna wspólna templatka wyglądała obco na każdym ekranie).
 *
 * Ten sam ruch co w Ekran, więc przejście w głąb i z powrotem działa już
 * na szkielecie.
 */
export function SzkieletEkranu({
  tytul,
  podtytul,
  children,
}: {
  tytul: string;
  /** `true` — podtytuł zależny od danych (np. ksywka), rysowany jako pasek. */
  podtytul?: string | true;
  children: React.ReactNode;
}) {
  return (
    <ViewTransition enter={RUCH} exit={RUCH} default={RUCH}>
      <section className="mx-auto w-full max-w-md px-4 pb-10" aria-busy="true" aria-label={`${tytul} — ładowanie`}>
        <header className="grid justify-items-center px-1 pb-4 pt-4 text-center">
          <h1 className="font-tytul text-[1.7rem] leading-tight tracking-tight text-kosc">{tytul}</h1>
          {podtytul === true ? (
            <Pasek className="mt-2.5 h-3 w-28" />
          ) : (
            podtytul && <p className="mt-1.5 text-xs text-dym">{podtytul}</p>
          )}
        </header>
        {children}
      </section>
    </ViewTransition>
  );
}

/** Szklany prostokąt, który pulsuje — karta, kafel, pole. */
export function Blok({ className = "" }: { className?: string }) {
  return <div className={`szklo animate-pulse rounded-md ${className}`} />;
}

/** Pasek tekstu. */
export function Pasek({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />;
}

/** Kółko — ikona, numer miejsca. */
export function Kolko({ className = "size-11" }: { className?: string }) {
  return <div className={`flex-none animate-pulse rounded-full bg-white/10 ${className}`} />;
}

/** Nagłówek sekcji w szkielecie — ten sam odstęp co NaglowekSekcji. */
export function PasekSekcji() {
  return <Pasek className="mb-3 ml-1 mt-8 h-2.5 w-24" />;
}

/** Wiersz listy: kółko, dwie linie tekstu, liczba z prawej. */
export function Wiersz({ ikona = true, liczba = false }: { ikona?: boolean; liczba?: boolean }) {
  return (
    <div className="szklo flex animate-pulse items-center gap-3 rounded-md px-4 py-3.5">
      {ikona && <Kolko className="size-10" />}
      <div className="grid flex-1 gap-2">
        <Pasek className="h-3 w-2/5" />
        <Pasek className="h-2.5 w-3/5 bg-white/5" />
      </div>
      {liczba && <Pasek className="h-5 w-8" />}
    </div>
  );
}

/** Karta z saldem — wspólna dla kasyna, gier, „Więcej” i sklepiku. */
export function Saldo() {
  return (
    <div className="szklo mb-4 flex animate-pulse items-center justify-between rounded-md px-4 py-4">
      <Pasek className="h-2.5 w-24" />
      <Pasek className="h-6 w-10" />
    </div>
  );
}

/** Szkielet ekranu admina: tytuł i lista wierszy. */
export function SzkieletAdmina({ tytul, podtytul, wiersze = 5 }: { tytul: string; podtytul?: string; wiersze?: number }) {
  return (
    <SzkieletEkranu tytul={tytul} podtytul={podtytul}>
      <div className="grid gap-2.5">
        {Array.from({ length: wiersze }, (_, i) => (
          <Wiersz key={i} ikona={false} />
        ))}
      </div>
    </SzkieletEkranu>
  );
}
