"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bladLogowania } from "@/lib/auth/blad";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const DOMENA = "@samorzad.ue.wroc.pl";

// Kod OTP zamiast magic linka: na telefonie przepisanie kilku cyfr jest
// wygodniejsze niż skakanie między aplikacją pocztową a przeglądarką.
export function Logowanie() {
  const router = useRouter();
  const parametry = useSearchParams();
  const bladZPowrotu = parametry.get("blad");

  const [email, setEmail] = useState("");
  const [kod, setKod] = useState("");
  const [etap, setEtap] = useState<"email" | "kod">("email");
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, setCzeka] = useState(false);
  // Czy mail faktycznie poszedł. Do ekranu z kodem można wejść także bez tego.
  const [wyslano, setWyslano] = useState(false);
  // Osobno od `czeka`, bo cofa się inaczej: `czeka` gaśnie po odpowiedzi
  // serwera, a to — dopiero gdy człowiek wróci na tę stronę.
  const [czekaGoogle, setCzekaGoogle] = useState(false);
  // Furtka mailowa startuje ukryta — Google jest drogą główną, a formularz
  // z adresem i kodem ma się pokazać dopiero, gdy ktoś naprawdę tego potrzebuje.
  // Inicjalizacja od razu z adresu (bez efektu): parametry z useSearchParams są
  // te same na serwerze i po hydracji, więc nie ma tu ryzyka rozjazdu — a `set
  // State` w efekcie i tak odrzuciłby eslint (react-hooks/set-state-in-effect).
  const [awaria, setAwaria] = useState(() => Boolean(parametry.get("awaria")));

  /**
   * Odblokowuje przycisk po powrocie z ekranu Google.
   *
   * Na iOS w trybie aplikacji ekran wyboru konta otwiera się jako nakładka nad
   * tą samą, żywą stroną — nie ma przeładowania. Kto się rozmyśli i zamknie
   * nakładkę, wraca do komponentu, w którym stan „czekam" został ustawiony
   * przed przekierowaniem i nikt go nie cofnął: przycisk zostaje wyłączony
   * na zawsze, a apka wygląda na zaciętą, aż do ubicia i uruchomienia od nowa.
   * W przeglądarce tego nie widać, bo tam następuje pełne przeładowanie.
   *
   * Przy udanym logowaniu ten efekt nie ma znaczenia — strona i tak odjeżdża
   * na /auth/callback, zanim ktokolwiek zobaczy odblokowany przycisk.
   */
  useEffect(() => {
    function odblokuj() {
      if (document.visibilityState === "visible") setCzekaGoogle(false);
    }
    document.addEventListener("visibilitychange", odblokuj);
    // Safari potrafi przywrócić stronę z pamięci podręcznej przy cofnięciu,
    // również bez przeładowania i bez zmiany widoczności.
    window.addEventListener("pageshow", odblokuj);
    return () => {
      document.removeEventListener("visibilitychange", odblokuj);
      window.removeEventListener("pageshow", odblokuj);
    };
  }, []);

  async function zalogujGoogle() {
    setBlad(null);
    setCzekaGoogle(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // `hd` to wyłącznie podpowiedź dla ekranu wyboru konta — prawdziwą
        // bramką jest wyzwalacz w bazie. `select_account` wymusza wybór konta
        // u kogoś, kto ma zalogowane prywatne i uczelniane naraz.
        queryParams: { hd: "samorzad.ue.wroc.pl", prompt: "select_account" },
      },
    });
    if (error) {
      setBlad(bladLogowania(error.message));
      setCzekaGoogle(false);
    }
  }

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

    if (!error) {
      setWyslano(true);
      setEtap("kod");
      return;
    }

    // Przy limicie wysyłki i tak przechodzimy do wpisywania kodu: wcześniejszy
    // kod z maila może być nadal ważny, a zatrzymanie człowieka na tym ekranie
    // znaczyłoby, że musi czekać godzinę mając w ręku działający kod.
    if (/rate limit|too many|security purposes/i.test(error.message)) {
      setBlad(
        "Limit wysyłki wyczerpany. Jeśli masz wcześniejszy kod, wpisz go poniżej.",
      );
      setEtap("kod");
      return;
    }

    setBlad(error.message);
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
    // dzięki czemu nowa osoba ląduje od razu na /app/rejestracja.
    router.refresh();
    router.push("/app");
  }

  return (
    <div className="grid gap-5">
      {bladZPowrotu && (
        <p className="text-center text-sm text-krew-jasna">{bladZPowrotu}</p>
      )}

      <Button onClick={zalogujGoogle} disabled={czeka || czekaGoogle}>
        {czekaGoogle ? "Łączę z Google..." : "Zaloguj przez Google"}
      </Button>

      {!awaria && (
        <Button variant="cichy" onClick={() => setAwaria(true)}>
          Nie mogę się zalogować
        </Button>
      )}

      {awaria &&
        (etap === "email" ? (
          <div className="grid gap-5">
            <p className="text-center text-xs text-dym">
              albo kodem na maila — furtka awaryjna
            </p>

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

            {/* Bez tego jedyna droga do pola z kodem prowadzi przez wysyłkę maila,
                a wbudowany mailer Supabase przepuszcza dwa na godzinę. Kto ma już
                kod, nie powinien palić limitu tylko po to, żeby go wpisać. */}
            <Button
              variant="szklo"
              onClick={() => {
                setBlad(null);
                setWyslano(false);
                setEtap("kod");
              }}
              disabled={czeka || !email}
            >
              Mam już kod
            </Button>
          </div>
        ) : (
          <div className="grid gap-5">
            <p className="text-center text-sm text-dym">
              {wyslano ? (
                <>
                  Kod poleciał na <span className="text-kosc">{email}</span>
                </>
              ) : (
                <>
                  Wpisz kod dla <span className="text-kosc">{email}</span>
                </>
              )}
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
              placeholder="kod z maila"
              value={kod}
              onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
              error={blad}
            />
            <Button onClick={potwierdz} disabled={czeka || kod.length < 6}>
              {czeka ? "Sprawdzam..." : "Wejdź"}
            </Button>
            <Button
              variant="szklo"
              onClick={() => {
                setEtap("email");
                setBlad(null);
              }}
            >
              Zmień adres
            </Button>
          </div>
        ))}
    </div>
  );
}
