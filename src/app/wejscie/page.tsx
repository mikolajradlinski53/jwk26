import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { ZamekInstalacji } from "@/components/ZamekInstalacji";
import { Logowanie } from "./Logowanie";

// Ta trasa leży poza bramką, więc sesję sprawdzamy tutaj: kto jest już
// zalogowany, nie ma po co oglądać ekranu wejścia.
export default async function WejsciePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <ZamekInstalacji>
      <Ekran tytul="Wstąp do Sekty">
        {/* Logowanie czyta błąd z adresu przez useSearchParams, a to wymaga
            granicy Suspense — bez niej build wywala całą trasę. */}
        <Suspense fallback={null}>
          <Logowanie />
        </Suspense>
      </Ekran>
    </ZamekInstalacji>
  );
}
