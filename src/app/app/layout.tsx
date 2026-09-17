import { PasekNawigacji } from "@/components/PasekNawigacji";
import { ZamekInstalacji } from "@/components/ZamekInstalacji";

export default function ApkaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Zamek obejmuje całą apkę, nie sam ekran wejścia. Nałożony wyłącznie tam
    // niczego nie zamykał: zalogowany otwierał /app/feed w zwykłej karcie
    // Safari i dostawał pełną treść — sprawdzone, 200 z całym HTML-em.
    <ZamekInstalacji>
      {/* Odstęp na pasek. Razem z `pb-10` z komponentu Ekran daje ok. 120 px
          nad dolną krawędzią — pasek ma jakieś 70 px z marginesem, więc ostatni
          element listy nie chowa się pod nim nawet na krótkich ekranach. */}
      <div className="pb-20">{children}</div>
      <PasekNawigacji />
    </ZamekInstalacji>
  );
}
