"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { przeczytajDowod } from "@/lib/ocr/run";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function FormularzRejestracji() {
  const router = useRouter();

  const [imieNazwisko, setImieNazwisko] = useState("");
  const [telefon, setTelefon] = useState("");
  const [zgodaSms, setZgodaSms] = useState(true);
  const [dieta, setDieta] = useState("");
  const [plik, setPlik] = useState<File | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [etap, setEtap] = useState<string | null>(null);

  const czeka = etap !== null;

  async function wyslij() {
    setBlad(null);

    if (imieNazwisko.trim().length < 3) {
      setBlad("Podaj imię i nazwisko");
      return;
    }
    if (!plik) {
      setBlad("Dołącz zdjęcie potwierdzenia przelewu");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBlad("Sesja wygasła — zaloguj się ponownie");
      return;
    }

    try {
      setEtap("Przygotowuję zdjęcie...");
      const zmniejszone = await skompresuj(plik);

      setEtap("Wysyłam dowód...");
      // Nazwa pliku od losowego UUID: dwa zgłoszenia tej samej osoby nie mogą
      // się nadpisać, a upload bez `upsert` i tak odmówiłby przy kolizji.
      const sciezka = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: bladUploadu } = await supabase.storage
        .from("proofs")
        .upload(sciezka, zmniejszone, { contentType: "image/jpeg" });
      if (bladUploadu) throw bladUploadu;

      setEtap("Odczytuję przelew...");
      const ocr = await przeczytajDowod(zmniejszone);

      setEtap("Zapisuję zgłoszenie...");
      const { error: bladProfilu } = await supabase
        .from("profiles")
        .update({
          display_name: imieNazwisko.trim(),
          phone: telefon.trim() || null,
          sms_consent: zgodaSms,
        })
        .eq("id", user.id);
      if (bladProfilu) throw bladProfilu;

      const { error: bladZgloszenia } = await supabase
        .from("registrations")
        .insert({
          user_id: user.id,
          full_name: imieNazwisko.trim(),
          phone: telefon.trim() || null,
          sms_consent: zgodaSms,
          diet_notes: dieta.trim() || null,
          proof_path: sciezka,
          ocr_text: ocr?.tekst ?? null,
          ocr_confidence: ocr?.pewnosc ?? null,
          ocr_keywords_hit: ocr?.trafienia.length ?? 0,
        });
      if (bladZgloszenia) throw bladZgloszenia;

      router.refresh();
    } catch (e) {
      setBlad(e instanceof Error ? e.message : "Coś poszło nie tak");
      setEtap(null);
    }
  }

  return (
    <div className="grid gap-5">
      <Field
        label="Imię i nazwisko"
        autoComplete="name"
        placeholder="Jan Kowalski"
        value={imieNazwisko}
        onChange={(e) => setImieNazwisko(e.target.value)}
      />

      <Field
        label="Telefon"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="600 100 200"
        value={telefon}
        onChange={(e) => setTelefon(e.target.value)}
      />

      <label className="flex items-start gap-3 text-sm text-smoke">
        <input
          type="checkbox"
          checked={zgodaSms}
          onChange={(e) => setZgodaSms(e.target.checked)}
          className="mt-1 size-5 accent-[var(--color-candle)]"
        />
        <span>Zgadzam się na SMS-y z komunikatami organizacyjnymi</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block font-display text-xs uppercase tracking-widest text-smoke">
          Dieta i uwagi
        </span>
        <textarea
          rows={3}
          value={dieta}
          onChange={(e) => setDieta(e.target.value)}
          placeholder="wegetarianizm, alergie, cokolwiek ważnego"
          className="w-full rounded-sm border border-candle/25 bg-ash px-3 py-2
                     text-parchment outline-none placeholder:text-smoke/60
                     focus:border-candle"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block font-display text-xs uppercase tracking-widest text-smoke">
          Potwierdzenie przelewu
        </span>
        <input
          type="file"
          accept="image/*"
          // `capture` podpowiada telefonowi aparat zamiast galerii — większość
          // osób i tak robi zdjęcie ekranu bankowości w momencie wypełniania.
          capture="environment"
          onChange={(e) => setPlik(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-smoke
                     file:mr-3 file:min-h-11 file:rounded-sm file:border-0
                     file:bg-candle file:px-4 file:font-display file:text-xs
                     file:uppercase file:tracking-widest file:text-void"
        />
        {plik && (
          <span className="mt-1.5 block text-sm text-smoke">
            {plik.name} ({Math.round(plik.size / 1024)} kB)
          </span>
        )}
      </label>

      {blad && <p className="text-sm text-blood">{blad}</p>}

      <Button onClick={wyslij} disabled={czeka}>
        {etap ?? "Złóż ofiarę"}
      </Button>

      <p className="text-center text-xs leading-relaxed text-smoke">
        Odczyt przelewu dzieje się na twoim telefonie i może chwilę potrwać.
        Zdjęcie widzi wyłącznie organizator.
      </p>
    </div>
  );
}
