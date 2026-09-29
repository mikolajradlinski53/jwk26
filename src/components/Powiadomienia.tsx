"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { komunikat } from "@/lib/zapisy/bledy";

type Stan =
  | "sprawdzam"
  | "brak-wsparcia"
  | "zainstaluj"
  | "zablokowane"
  | "wylaczone"
  | "wlaczone";

const OPIS: Record<Stan, string> = {
  sprawdzam: "Sprawdzam…",
  "brak-wsparcia": "Ta przeglądarka nie obsługuje powiadomień.",
  zainstaluj:
    "Na iPhonie powiadomienia działają tylko w apce dodanej do ekranu głównego: Udostępnij → „Do ekranu początkowego”.",
  zablokowane:
    "Powiadomienia są zablokowane w ustawieniach telefonu. Włącz je dla tej apki, a potem wróć tutaj.",
  wylaczone: "Dostaniesz ogłoszenia organizatorów i informacje o swojej drużynie.",
  wlaczone: "Powiadomienia są włączone na tym urządzeniu.",
};

const KLUCZ = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function kluczDoBajtow(base64: string): Uint8Array<ArrayBuffer> {
  const dopelnienie = "=".repeat((4 - (base64.length % 4)) % 4);
  const surowe = atob((base64 + dopelnienie).replace(/-/g, "+").replace(/_/g, "/"));
  const bajty = new Uint8Array(new ArrayBuffer(surowe.length));
  for (let i = 0; i < surowe.length; i++) bajty[i] = surowe.charCodeAt(i);
  return bajty;
}

function naIPhonieBezInstalacji(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const zainstalowana =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return ios && !zainstalowana;
}

async function zapiszNaSerwerze(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await createClient().rpc("zapisz_subskrypcje", {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
  });
  if (error) throw error;
}

/** Stan startowy. Istniejącą subskrypcję zapisujemy ponownie: baza mogła ją
 *  skasować jako martwą, a telefon nadal uważa się za zapisany. */
async function sprawdz(): Promise<Stan> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return naIPhonieBezInstalacji() ? "zainstaluj" : "brak-wsparcia";
  }
  if (!KLUCZ) return "brak-wsparcia";
  if (Notification.permission === "denied") return "zablokowane";

  const rejestracja = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  const sub = await rejestracja.pushManager.getSubscription();
  if (!sub) return "wylaczone";
  await zapiszNaSerwerze(sub);
  return "wlaczone";
}

/**
 * Włączanie powiadomień na tym urządzeniu. Jest też na ekranie oczekiwania,
 * bo pierwsze powiadomienie, jakie ktoś dostaje, to „zgłoszenie przyjęte".
 */
export function Powiadomienia() {
  const [stan, setStan] = useState<Stan>("sprawdzam");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  const [wyslanoProbne, setWyslanoProbne] = useState(false);
  const wToku = useRef(false);

  useEffect(() => {
    let aktywny = true;
    sprawdz().then(
      (s) => aktywny && setStan(s),
      (e) => {
        console.error("Sprawdzenie powiadomień nie przeszło:", e);
        if (aktywny) setStan("wylaczone");
      },
    );
    return () => {
      aktywny = false;
    };
  }, []);

  /** Próbne powiadomienie do siebie - jedyny sposób, żeby każdy sprawdził,
   *  czy u niego budzi telefon i wyskakuje u góry. Tego strona nie ustawi. */
  async function probne() {
    if (wToku.current) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);
    setWyslanoProbne(false);
    const { error } = await createClient().rpc("probne_powiadomienie");
    setCzeka(false);
    wToku.current = false;
    if (error) {
      console.error("Próbne powiadomienie nie przeszło:", { code: error.code, message: error.message });
      setBlad(komunikat(error));
      return;
    }
    setWyslanoProbne(true);
  }

  async function przelacz(wlacz: boolean) {
    if (wToku.current || !KLUCZ) return;
    wToku.current = true;
    setCzeka(true);
    setBlad(null);

    try {
      const rejestracja = await navigator.serviceWorker.ready;
      if (wlacz) {
        // Prośba o zgodę musi wyjść z kliknięcia - iOS ignoruje ją w innym momencie.
        const zgoda = await Notification.requestPermission();
        if (zgoda !== "granted") {
          setStan(zgoda === "denied" ? "zablokowane" : "wylaczone");
          return;
        }
        const sub = await rejestracja.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: kluczDoBajtow(KLUCZ),
        });
        await zapiszNaSerwerze(sub);
        setStan("wlaczone");
      } else {
        const sub = await rejestracja.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await createClient().rpc("usun_subskrypcje", { p_endpoint: endpoint });
        }
        setStan("wylaczone");
      }
    } catch (e) {
      console.error("Zmiana powiadomień nie przeszła:", e);
      setBlad(komunikat(e));
    } finally {
      setCzeka(false);
      wToku.current = false;
    }
  }

  return (
    <section className="mt-8 grid gap-2.5">
      <h2 className="px-1 text-xs uppercase tracking-[0.14em] text-dym">Powiadomienia</h2>
      <div className="szklo grid gap-3 rounded-md px-4 py-3.5">
        <p className="text-sm text-dym">{OPIS[stan]}</p>
        {stan === "wylaczone" && (
          <Button onClick={() => void przelacz(true)} disabled={czeka}>
            {czeka ? "Włączam…" : "Włącz powiadomienia"}
          </Button>
        )}
        {stan === "wlaczone" && (
          <>
            <Button onClick={() => void probne()} disabled={czeka}>
              {czeka ? "Wysyłam…" : "Wyślij próbne powiadomienie"}
            </Button>
            {wyslanoProbne && (
              <p role="status" className="text-sm text-kosc">
                Wysłane - powinno przyjść w ciągu kilku sekund. Zablokuj telefon albo
                wyjdź z apki, żeby zobaczyć, jak wygląda.
              </p>
            )}
            <details className="text-sm text-dym">
              <summary className="flex min-h-11 cursor-pointer items-center">
                Nie wyskakuje u góry ekranu albo nie ma dźwięku?
              </summary>
              <div className="grid gap-2 pb-1 leading-relaxed">
                <p>
                  <strong className="text-kosc">iPhone:</strong> Ustawienia → Powiadomienia → Sekta
                  → włącz „Pozwalaj na powiadomienia”, zaznacz „Ekran blokady”, „Centrum powiadomień”
                  i „Banery”, styl banera „Trwały”, włącz „Dźwięki”. Jeśli używasz trybu Skupienie
                  albo Podsumowania zaplanowanego, dodaj Sektę do wyjątków.
                </p>
                <p>
                  <strong className="text-kosc">Android:</strong> przytrzymaj powiadomienie JWK26 →
                  Ustawienia (albo Ustawienia → Aplikacje → Chrome → Powiadomienia → jwk26.pl) →
                  włącz „Wyskakujące na ekranie” / „Pokazuj u góry ekranu” i dźwięk. Na telefonach
                  Xiaomi, Huawei i Samsung wyłącz też oszczędzanie baterii dla Chrome.
                </p>
              </div>
            </details>
            <Button variant="szklo" onClick={() => void przelacz(false)} disabled={czeka}>
              {czeka ? "Wyłączam…" : "Wyłącz na tym urządzeniu"}
            </Button>
          </>
        )}
        {blad && (
          <p role="alert" className="text-sm text-krew-jasna">
            {blad}
          </p>
        )}
      </div>
    </section>
  );
}
