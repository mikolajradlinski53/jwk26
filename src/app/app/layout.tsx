import { PasekNawigacji } from "@/components/PasekNawigacji";

export default function ApkaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Odstęp na pasek. Razem z `pb-10` z komponentu Ekran daje ok. 120 px
          nad dolną krawędzią — pasek ma jakieś 70 px z marginesem, więc ostatni
          element listy nie chowa się pod nim nawet na krótkich ekranach. */}
      <div className="pb-20">{children}</div>
      <PasekNawigacji />
    </>
  );
}
