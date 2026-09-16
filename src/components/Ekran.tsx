export function Ekran({
  tytul,
  podtytul,
  children,
}: {
  tytul: string;
  podtytul?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-md px-4 pb-10">
      {/* Odstęp na wcięcie ekranu daje `body` przez env(safe-area-inset-top),
          więc tutaj zostaje tylko oddech typograficzny. Wcześniejsze `pt-7`
          było dobrane pod widok z paskiem adresu i w trybie aplikacji
          zostawało jako pusta przestrzeń. */}
      <header className="px-1 pb-4 pt-4 text-center">
        <h1 className="font-tytul text-[1.7rem] leading-tight tracking-tight text-kosc">
          {tytul}
        </h1>
        {podtytul && <p className="mt-1.5 text-xs text-dym">{podtytul}</p>}
      </header>
      {children}
    </section>
  );
}
