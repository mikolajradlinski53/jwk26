"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat, tekstBledu } from "@/lib/zapisy/bledy";
import { wgrajDowod, polaOcr, type WgranyDowod } from "@/lib/zapisy/przelew";
import { WyborZdjecia } from "./WyborZdjecia";
import { DanePrzelewu } from "@/components/DanePrzelewu";
import type { DanePrzelewu as DanePrzelewuTyp } from "@/lib/zapisy/qrPrzelewu";

export function DolaczPrzelew({
  przelew,
  tytul,
}: {
  przelew: DanePrzelewuTyp | null;
  tytul: string;
}) {
  const router = useRouter();
  const [plik, setPlik] = useState<File | null>(null);
  const [bladPliku, setBladPliku] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [etap, setEtap] = useState<string | null>(null);
  const wToku = useRef(false);
  const wgrane = useRef<WgranyDowod | null>(null);

  async function wyslij() {
    if (wToku.current) return;
    if (!plik && !wgrane.current) {
      setBladPliku("Dołącz zdjęcie potwierdzenia przelewu");
      return;
    }

    wToku.current = true;
    setBlad(null);
    setEtap("Zapisuję...");

    try {
      if (plik && !wgrane.current) {
        wgrane.current = await wgrajDowod(plik, setEtap);
      }
      setEtap("Zapisuję...");
      const { error } = await createClient().rpc("dolacz_przelew", {
        p_proof_path: wgrane.current!.sciezka,
        ...polaOcr(wgrane.current),
      });
      if (error) throw error;
      router.refresh();
    } catch (e) {
      // Tylko kod i treść: `details` błędu Postgresa bywa całym wierszem.
      console.error("Dołączenie przelewu nie przeszło:", {
        code: (e as { code?: string })?.code,
        message: tekstBledu(e),
      });
      // Zapis mógł przejść, a zgubiła się tylko odpowiedź — ponowienie
      // zwraca wtedy „brak zgłoszenia czekającego na przelew". Świeży render
      // strony pokaże właściwy stan (poczekalnię), zamiast straszyć błędem.
      if (/czekajacego na przelew/.test(tekstBledu(e))) {
        router.refresh();
        return;
      }
      setBlad(komunikat(e));
      setEtap(null);
      wToku.current = false;
    }
  }

  return (
    <div className="grid gap-5">
      <DanePrzelewu dane={przelew} tytul={tytul} />
      <WyborZdjecia
        plik={plik}
        blad={bladPliku}
        // Zmiana pliku w trakcie wysyłki nadpisałaby wynik starego uploadu.
        disabled={etap !== null}
        onWybor={(f) => {
          setPlik(f);
          setBladPliku(null);
          wgrane.current = null;
        }}
      />
      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      <Button onClick={() => void wyslij()} disabled={etap !== null}>
        {etap ?? "Wyślij potwierdzenie"}
      </Button>
    </div>
  );
}
