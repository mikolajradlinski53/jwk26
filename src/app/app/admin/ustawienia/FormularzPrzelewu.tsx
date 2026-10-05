"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { cyfry, kontoCzytelne, kontoPoprawne } from "@/lib/zapisy/qrPrzelewu";

/**
 * Dane do przelewu: z nich formularz zapisów i landing składają kod QR
 * i kartę „Dane do przelewu". Puste konto to stan dozwolony - oba miejsca
 * mówią wtedy „dane pojawią się wkrótce".
 */
export function FormularzPrzelewu({
  poczatkowe,
}: {
  poczatkowe: { konto: string; odbiorca: string; kwota: number | null; telefon: string };
}) {
  const router = useRouter();
  const [konto, setKonto] = useState(poczatkowe.konto ? kontoCzytelne(poczatkowe.konto) : "");
  const [odbiorca, setOdbiorca] = useState(poczatkowe.odbiorca);
  const [kwota, setKwota] = useState(poczatkowe.kwota === null ? "" : String(poczatkowe.kwota));
  const [telefon, setTelefon] = useState(poczatkowe.telefon);
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState(false);
  const [czeka, setCzeka] = useState(false);
  const wToku = useRef(false);

  async function zapisz() {
    if (wToku.current) return;
    setBlad(null);
    setUdane(false);

    const liczba = Number(kwota.replace(",", "."));
    if (konto.trim() !== "" && !kontoPoprawne(konto)) {
      setBlad("Numer konta to 26 cyfr (spacje i „PL” na początku są w porządku)");
      return;
    }
    if (konto.trim() !== "" && odbiorca.trim() === "") {
      setBlad("Podaj odbiorcę - bez niego bank nie przyjmie przelewu z kodu QR");
      return;
    }
    if (telefon.trim() !== "" && !/^\+?[0-9 ()-]{9,20}$/.test(telefon.trim())) {
      setBlad("Numer telefonu to 9 cyfr, ewentualnie z +48 i spacjami");
      return;
    }
    if (!Number.isFinite(liczba) || liczba <= 0 || liczba > 10000) {
      setBlad("Kwota to liczba złotych większa od zera");
      return;
    }

    wToku.current = true;
    setCzeka(true);

    // Jedno zapytanie na wszystkie klucze, jak w formularzu dat - pętla update
    // zostawiała bazę w stanie mieszanym, gdy padało któreś z kolei.
    const { error } = await createClient()
      .from("app_settings")
      .upsert(
        [
          { key: "przelew_numer_konta", value: cyfry(konto) },
          { key: "przelew_odbiorca", value: odbiorca.trim() },
          { key: "przelew_kwota", value: Math.round(liczba * 100) / 100 },
          { key: "przelew_telefon", value: telefon.trim() },
        ],
        { onConflict: "key" },
      );

    setCzeka(false);
    wToku.current = false;

    if (error) {
      console.error("Zapis danych do przelewu nie przeszedł:", {
        code: error.code,
        message: error.message,
      });
      setBlad("Zapis się nie udał. Spróbuj jeszcze raz.");
      return;
    }
    setUdane(true);
    router.refresh();
  }

  return (
    <section className="mt-10 grid gap-4">
      <h2 className="px-1 text-xs uppercase tracking-[0.14em] text-dym">Dane do przelewu</h2>
      <Field
        label="Numer konta"
        inputMode="numeric"
        placeholder="12 3456 7890 1234 5678 9012 3456"
        value={konto}
        onChange={(e) => setKonto(e.target.value)}
      />
      <Field
        label="Odbiorca"
        placeholder="Samorząd Studencki UEW"
        maxLength={70}
        value={odbiorca}
        onChange={(e) => setOdbiorca(e.target.value)}
      />
      <Field
        label="Kwota (zł)"
        inputMode="decimal"
        value={kwota}
        onChange={(e) => setKwota(e.target.value)}
      />
      <Field
        label="Numer telefonu (opcjonalnie)"
        inputMode="tel"
        placeholder="500 600 700"
        value={telefon}
        onChange={(e) => setTelefon(e.target.value)}
      />
      <p className="-mt-2 px-1 text-xs leading-relaxed text-dym">
        W kodzie QR odbiorca mieści się w 20 znakach, a polskie litery idą bez ogonków -
        tak wymaga standard banków. Na ekranie widać pełną nazwę.
      </p>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      {udane && (
        <p role="status" className="text-sm text-krew-jasna">
          Zapisano
        </p>
      )}

      <Button onClick={() => void zapisz()} disabled={czeka}>
        {czeka ? "Zapisuję..." : "Zapisz dane do przelewu"}
      </Button>
    </section>
  );
}
