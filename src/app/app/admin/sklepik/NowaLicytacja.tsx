"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { skompresuj } from "@/lib/obrazy";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { ShopItem } from "@/types/db";

const ETYKIETA = "mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym";
const POLE = "szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none focus-visible:border-krew";

/** `datetime-local` → ISO. Telefon admina jest w czasie polskim, więc czas lokalny przeglądarki. */
function naIso(wartosc: string): string | null {
  const d = new Date(wartosc);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Wystawienie licytacji (2026-10-22): przedmiot z katalogu albo nowy (z
 * grafiką), cena wywoławcza, otwarcie, zamknięcie, „w ciemno”. Ogłoszenie
 * otwarcia wysyła cron w ciągu minuty od startu.
 */
export function NowaLicytacja({ katalog }: { katalog: ShopItem[] }) {
  const router = useRouter();
  const [nowy, setNowy] = useState(false);
  const [itemId, setItemId] = useState(katalog[0]?.id ?? "");
  const [nazwa, setNazwa] = useState("");
  const [opis, setOpis] = useState("");
  const [plik, setPlik] = useState<File | null>(null);
  const [cena, setCena] = useState("50");
  const [odRazu, setOdRazu] = useState(true);
  const [start, setStart] = useState("");
  const [koniec, setKoniec] = useState("");
  const [wCiemno, setWCiemno] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState<string | null>(null);
  const [czeka, setCzeka] = useState<string | null>(null);
  const wToku = useRef(false);

  async function wystaw() {
    if (wToku.current) return;
    setBlad(null);
    setUdane(null);
    const c = Number.parseInt(cena, 10);
    const startIso = odRazu ? new Date().toISOString() : naIso(start);
    const koniecIso = naIso(koniec);
    if (!Number.isFinite(c) || c < 1) return setBlad("Cena wywoławcza to liczba większa od zera.");
    if (!startIso) return setBlad("Podaj godzinę otwarcia.");
    if (!koniecIso || koniecIso <= startIso) return setBlad("Zamknięcie musi być po otwarciu.");
    if (nowy && (!nazwa.trim() || !opis.trim())) return setBlad("Nowy przedmiot potrzebuje nazwy i opisu.");
    if (!nowy && !itemId) return setBlad("Wybierz przedmiot.");

    wToku.current = true;
    const supabase = createClient();
    try {
      let grafika: string | null = null;
      if (plik) {
        setCzeka("Wysyłam grafikę...");
        const sciezka = `${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("przedmioty")
          .upload(sciezka, await skompresuj(plik), { contentType: "image/jpeg" });
        if (error) throw error;
        grafika = sciezka;
      }

      setCzeka("Wystawiam...");
      let przedmiot = itemId;
      if (nowy) {
        const { data, error } = await supabase
          .from("shop_items")
          // W ciemno: nowy przedmiot ukryty w katalogu, żeby nie dało się go
          // podejrzeć z listy pozycji (licytacje_lista i tak go maskuje).
          .insert({ name: nazwa.trim(), description: opis.trim(), kind: "physical", price: c, grafika, active: true, ukryta: wCiemno })
          .select("id")
          .single();
        if (error) throw error;
        przedmiot = data.id as string;
      } else if (grafika) {
        const { error } = await supabase.from("shop_items").update({ grafika }).eq("id", przedmiot);
        if (error) throw error;
      }

      const { error } = await supabase.from("licytacje").insert({
        item_id: przedmiot,
        cena_wywolawcza: c,
        start: startIso,
        koniec: koniecIso,
        w_ciemno: wCiemno,
      });
      if (error) throw error;

      setUdane("Wystawione. Ogłoszenie otwarcia pójdzie w ciągu minuty od startu.");
      setNazwa("");
      setOpis("");
      setPlik(null);
      router.refresh();
    } catch (e) {
      console.error("Wystawienie licytacji nie przeszło:", e);
      setBlad("Nie udało się wystawić. Odśwież i spróbuj jeszcze raz.");
    } finally {
      setCzeka(null);
      wToku.current = false;
    }
  }

  return (
    <section className="szklo grid gap-3 rounded-md p-4">
      <div className="grid grid-cols-2 gap-2">
        <Button variant={nowy ? "cichy" : "krew"} onClick={() => setNowy(false)}>
          Z katalogu
        </Button>
        <Button variant={nowy ? "krew" : "cichy"} onClick={() => setNowy(true)}>
          Nowy przedmiot
        </Button>
      </div>

      {nowy ? (
        <>
          <Field label="Nazwa" value={nazwa} maxLength={60} onChange={(e) => setNazwa(e.target.value)} />
          <label className="block">
            <span className={ETYKIETA}>Opis</span>
            <textarea
              value={opis}
              onChange={(e) => setOpis(e.target.value.slice(0, 300))}
              rows={2}
              className="szklo w-full rounded-sm px-3.5 py-2.5 text-sm text-kosc outline-none focus-visible:border-krew"
            />
          </label>
        </>
      ) : (
        <label className="block">
          <span className={ETYKIETA}>Przedmiot</span>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={POLE}>
            {katalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.kind === "digital" ? " (efekt)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className={ETYKIETA}>Grafika {nowy ? "(opcjonalnie)" : "(opcjonalnie - podmienia obecną)"}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPlik(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-dym file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-krew file:px-4 file:text-xs file:font-bold file:text-white"
        />
      </label>

      <Field
        label="Cena wywoławcza (pkt)"
        inputMode="numeric"
        value={cena}
        onChange={(e) => /^\d*$/.test(e.target.value) && setCena(e.target.value)}
      />

      <label className="flex min-h-11 items-center gap-3 text-sm text-kosc">
        <input type="checkbox" checked={odRazu} onChange={(e) => setOdRazu(e.target.checked)} className="size-5 accent-[#c8102e]" />
        Otwórz od razu
      </label>
      {!odRazu && (
        <label className="block">
          <span className={ETYKIETA}>Otwarcie</span>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={POLE} />
        </label>
      )}
      <label className="block">
        <span className={ETYKIETA}>Zamknięcie</span>
        <input type="datetime-local" value={koniec} onChange={(e) => setKoniec(e.target.value)} className={POLE} />
      </label>

      <label className="flex min-h-11 items-center gap-3 text-sm text-kosc">
        <input type="checkbox" checked={wCiemno} onChange={(e) => setWCiemno(e.target.checked)} className="size-5 accent-[#c8102e]" />
        W ciemno (Tajemnicza nagroda do zamknięcia)
      </label>

      {blad && (
        <p role="alert" className="text-sm text-krew-jasna">
          {blad}
        </p>
      )}
      {udane && (
        <p role="status" className="text-sm text-kosc">
          {udane}
        </p>
      )}
      <Button onClick={() => void wystaw()} disabled={czeka !== null}>
        {czeka ?? "Wystaw na licytację"}
      </Button>
    </section>
  );
}
