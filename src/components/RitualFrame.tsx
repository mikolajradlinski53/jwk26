export function RitualFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="flicker mb-8 text-center font-display text-2xl uppercase tracking-[0.3em] text-candle">
        {title}
      </h1>
      {children}
    </section>
  );
}
