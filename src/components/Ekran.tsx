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
    <section className="mx-auto w-full max-w-md px-4">
      <header className="px-1 pb-4 pt-7 text-center">
        <h1 className="font-tytul text-[1.7rem] leading-tight tracking-tight text-kosc">
          {tytul}
        </h1>
        {podtytul && <p className="mt-1.5 text-xs text-dym">{podtytul}</p>}
      </header>
      {children}
    </section>
  );
}
