"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_DOMAIN = "@samorzad.ue.wroc.pl";

// Logowanie kodem OTP (6 cyfr) mailem — na telefonie wygodniejsze niż magic link.
// Walidacja domeny tu (UX) + trigger w bazie (twardy backstop).
export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setError(null);
    if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      setError(`Tylko adresy ${ALLOWED_DOMAIN}`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/");
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 16 }}>
      <h1>🕯️ Wstąp do Sekty</h1>

      {step === "email" ? (
        <>
          <input
            type="email"
            placeholder="imie.nazwisko@samorzad.ue.wroc.pl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 12 }}
          />
          <button onClick={sendCode} disabled={loading} style={{ width: "100%", padding: 10, marginTop: 12 }}>
            {loading ? "Wysyłam..." : "Wyślij kod"}
          </button>
        </>
      ) : (
        <>
          <p>Wpisz kod z maila ({email})</p>
          <input
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 12 }}
          />
          <button onClick={verify} disabled={loading} style={{ width: "100%", padding: 10, marginTop: 12 }}>
            {loading ? "Sprawdzam..." : "Wejdź"}
          </button>
        </>
      )}

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
    </main>
  );
}
