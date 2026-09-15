"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RitualFrame } from "@/components/RitualFrame";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const DOMENA = "@samorzad.ue.wroc.pl";

// Kod OTP zamiast magic linka: na telefonie przepisanie sześciu cyfr jest
// wygodniejsze niż skakanie między aplikacją pocztową a przeglądarką.
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [kod, setKod] = useState("");
  const [etap, setEtap] = useState<"email" | "kod">("email");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);

  async function wyslijKod() {
    setBlad(null);
    if (!email.trim().toLowerCase().endsWith(DOMENA)) {
      setBlad(`Wpuszczamy wyłącznie adresy ${DOMENA}`);
      return;
    }
    setCzeka(true);
    // Klient powstaje dopiero tutaj, nie przy renderze: Next prerenderuje tę
    // stronę przy buildzie, a wtedy zmiennych środowiskowych może nie być.
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setCzeka(false);
    if (error) setBlad(error.message);
    else setEtap("kod");
  }

  async function potwierdz() {
    setBlad(null);
    setCzeka(true);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: kod.trim(),
      type: "email",
    });
    setCzeka(false);
    if (error) {
      setBlad(error.message);
      return;
    }
    // refresh() zmusza bramkę do ponownej oceny statusu profilu,
    // dzięki czemu nowa osoba ląduje od razu na /rejestracja.
    router.refresh();
    router.push("/");
  }

  return (
    <RitualFrame title="Wstąp do Sekty">
      {etap === "email" ? (
        <div className="grid gap-5">
          <Field
            label="Adres wtajemniczenia"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={`imie.nazwisko${DOMENA}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={blad}
          />
          <Button onClick={wyslijKod} disabled={czeka || !email}>
            {czeka ? "Wysyłam znak..." : "Wyślij kod"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-5">
          <p className="text-center text-sm text-smoke">
            Kod poleciał na <span className="text-parchment">{email}</span>
          </p>
          <Field
            label="Kod"
            inputMode="numeric"
            autoComplete="one-time-code"
            // Długość kodu jest ustawieniem projektu Supabase (Authentication →
            // Email OTP Length, 6–10 cyfr), nie stałą. Zaszyte na sztywno sześć
            // znaczyło, że przy dłuższym kodzie nie dało się zalogować w ogóle:
            // maxLength ucinał wpisywanie, a przycisk i tak pozostawał aktywny
            // dla wartości, której serwer nie przyjmie.
            maxLength={10}
            placeholder="123456"
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
            error={blad}
          />
          <Button onClick={potwierdz} disabled={czeka || kod.length < 6}>
            {czeka ? "Sprawdzam..." : "Wejdź"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setEtap("email");
              setBlad(null);
            }}
          >
            Zmień adres
          </Button>
        </div>
      )}
    </RitualFrame>
  );
}
