"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";

/**
 * Flaga regulaminu (D8). Włączenie z dodatkowym potwierdzeniem, bo od niej
 * zależy, czy zgody z formularza cokolwiek wiążą.
 */
export function Regulamin({ zatwierdzony }: { zatwierdzony: boolean }) {
  const router = useRouter();
  const [pyta, setPyta] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function ustaw(wartosc: boolean) {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    // Zwykły upsert: admin pisze do app_settings przez politykę
    // settings_admin_write, tak jak w /app/admin/ustawienia.
    const { error } = await createClient()
      .from("app_settings")
      .upsert({ key: "regulamin_zatwierdzony", value: wartosc }, { onConflict: "key" });

    setCzeka(false);
    wToku.current = false;
    setPyta(false);

    if (error) {
      console.error("Zmiana flagi regulaminu nie przeszła:", error);
      setBlad(komunikat(error));
      return;
    }
    router.refresh();
  }

  return (
    <section className="szklo grid gap-3 rounded-md px-4 py-4">
      <h2 className="text-sm font-bold">Regulamin</h2>
      <p className="text-sm text-dym">
        {zatwierdzony
          ? "Zatwierdzony. Baner „wersja robocza” zniknął z /regulamin, tury można otwierać."
          : "Wersja robocza. Dopóki tak jest, nikt się nie zapisze i żadnej tury nie da się otworzyć."}
      </p>

      {!zatwierdzony && !pyta && (
        <Button variant="szklo" onClick={() => setPyta(true)}>
          Oznacz jako zatwierdzony
        </Button>
      )}

      {!zatwierdzony && pyta && (
        <>
          <p className="text-xs leading-relaxed text-kosc">
            Zrób to dopiero wtedy, gdy zarząd przyjął regulamin, a klauzula
            informacyjna i oświadczenie o szkodach są w ostatecznej wersji.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="szklo" onClick={() => setPyta(false)} disabled={czeka}>
              Jeszcze nie
            </Button>
            <Button onClick={() => void ustaw(true)} disabled={czeka}>
              Zatwierdzony
            </Button>
          </div>
        </>
      )}

      {zatwierdzony && !pyta && (
        <Button variant="cichy" onClick={() => setPyta(true)} disabled={czeka}>
          Cofnij do wersji roboczej
        </Button>
      )}

      {zatwierdzony && pyta && (
        <>
          <p className="text-xs leading-relaxed text-kosc">
            Cofnięcie zatrzyma zapisy we wszystkich turach — nikt się nie zapisze,
            dopóki regulamin znów nie zostanie zatwierdzony.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="szklo" onClick={() => setPyta(false)} disabled={czeka}>
              Zostaw
            </Button>
            <Button onClick={() => void ustaw(false)} disabled={czeka}>
              Cofnij
            </Button>
          </div>
        </>
      )}

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
    </section>
  );
}
