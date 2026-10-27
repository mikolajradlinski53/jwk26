import { createClient } from "@/lib/supabase/server";
import { KolejkiAdmina } from "@/components/KolejkiAdmina";
import { ZamekInstalacji } from "@/components/ZamekInstalacji";
import { Poczekalnia } from "@/components/Poczekalnia";
import { czekaNaOtwarcie } from "@/lib/poczekalnia";
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
    ? await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle()
    : { data: null };

  // Poczekalnia: przyjęty uczestnik przed `otwarcie_platformy` widzi ekran
  // z licznikiem zamiast apki. Ustawienie czytamy tylko dla przyjętych
  // nie-adminów - reszta nie płaci za dodatkowe zapytanie.
  const moglbyCzekac = profil?.status === "approved" && profil.role !== "admin";
  const { data: otwarcie } = moglbyCzekac
    ? await supabase.from("app_settings").select("value").eq("key", "otwarcie_platformy").maybeSingle()
    : { data: null };
  if (
    czekaNaOtwarcie({
      rola: profil?.role,
      status: profil?.status,
      otwarcie: otwarcie?.value,
      teraz: new Date(),
    })
  ) {
    return (
      <ZamekInstalacji>
        <Poczekalnia otwarcie={otwarcie!.value as string} />
      </ZamekInstalacji>
    );
  }

  // Po wyjeździe (2026-10-27) apka jest zamknięta: bez dolnego paska (każdy
  // jego ekran przekierowuje na zaślepkę) i bez zamka instalacji, żeby
  // podziękowanie otwierało się też w zwykłej przeglądarce.
  return (
    <KolejkiAdmina jestAdminem={profil?.role === "admin"}>
      <div className="pb-10">{children}</div>
    </KolejkiAdmina>
  );
}
