import { createClient } from "@/lib/supabase/server";
import { KolejkiAdmina } from "@/components/KolejkiAdmina";
import { PasekNawigacji } from "@/components/PasekNawigacji";
import { ZamekInstalacji } from "@/components/ZamekInstalacji";
import { METADANE_APKI } from "@/lib/metadaneApki";

export const metadata = METADANE_APKI;

export default async function ApkaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rola decyduje tylko o tym, czy apka pyta bazę o kolejki admina. Layout
  // przeżywa nawigację, więc to zapytanie idzie raz na wejście, nie na ekran.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    // Zamek obejmuje całą apkę, nie sam ekran wejścia. Nałożony wyłącznie tam
    // niczego nie zamykał: zalogowany otwierał /app/feed w zwykłej karcie
    // Safari i dostawał pełną treść - sprawdzone, 200 z całym HTML-em.
    <ZamekInstalacji>
      <KolejkiAdmina jestAdminem={profil?.role === "admin"}>
        {/* Odstęp na pasek. Razem z `pb-10` z komponentu Ekran daje ok. 120 px
            nad dolną krawędzią - pasek ma jakieś 70 px z marginesem, więc ostatni
            element listy nie chowa się pod nim nawet na krótkich ekranach. */}
        <div className="pb-20">{children}</div>
        <PasekNawigacji />
      </KolejkiAdmina>
    </ZamekInstalacji>
  );
}
