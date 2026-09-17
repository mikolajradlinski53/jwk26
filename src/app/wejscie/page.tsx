import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Logowanie } from "./Logowanie";
import { Tutorial } from "./Tutorial";

// Ta trasa leży poza bramką, więc sesję sprawdzamy tutaj: kto jest już
// zalogowany, nie ma po co oglądać ekranu wejścia.
export default async function WejsciePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <Ekran tytul="Wstąp do Sekty">
      {/* Oba warianty są w drzewie, widoczność rozstrzyga CSS. To bramka
          wygody, nie bezpieczeństwa — treści apki tu nie ma. */}
      <div className="tylko-w-przegladarce">
        <Tutorial />
      </div>
      <div className="tylko-w-apce">
        {/* Logowanie czyta błąd z adresu przez useSearchParams, a to wymaga
            granicy Suspense — bez niej build wywala całą trasę. */}
        <Suspense fallback={null}>
          <Logowanie />
        </Suspense>
      </div>
    </Ekran>
  );
}
