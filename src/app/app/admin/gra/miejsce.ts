"use server";

import { createClient } from "@/lib/supabase/server";
import { toKrotkiLink, wspolrzedneZTekstu, type Punkt } from "@/lib/mapy";

// Rozwijamy wyłącznie linki Google - akcja nie może służyć za furtkę do
// odpytywania dowolnych adresów z serwera.
const HOST_GOOGLE = /(^|\.)goo\.gl$|^g\.co$|(^|\.)google\.[a-z.]+$/;

async function rozwin(url: string): Promise<string[]> {
  const adresy = [url];
  let adres = url;
  for (let i = 0; i < 5; i++) {
    if (!HOST_GOOGLE.test(new URL(adres).hostname)) break;
    const odp = await fetch(adres, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (JWK26)" },
      signal: AbortSignal.timeout(5000),
    });
    const dalej = odp.headers.get("location");
    if (!dalej) break;
    adres = new URL(dalej, adres).toString();
    adresy.push(adres);
    if (wspolrzedneZTekstu(adres)) break;
  }
  return adresy;
}

/**
 * Miejsce zadania gry terenowej z tego, co wkleił admin: link z Map Google
 * (także krótki maps.app.goo.gl z „Udostępnij” - rozwijany tutaj, bo
 * przeglądarka nie przeczyta przekierowania z innej domeny) albo same
 * współrzędne.
 */
export async function miejsceZLinku(tekst: string): Promise<{ punkt: Punkt; link: string | null } | { blad: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { blad: "Sesja wygasła - zaloguj się ponownie." };
  const { data: profil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin") return { blad: "Miejsce ustawia Organizator." };

  const t = tekst.trim().slice(0, 2000);
  // „Udostępnij” w aplikacji daje często nazwę miejsca i link w jednym tekście.
  const url = t.match(/https?:\/\/\S+/)?.[0] ?? null;

  let punkt = wspolrzedneZTekstu(url ?? t);
  if (!punkt && url && (toKrotkiLink(url) || HOST_GOOGLE.test(new URL(url).hostname))) {
    try {
      for (const adres of await rozwin(url)) {
        punkt = wspolrzedneZTekstu(adres);
        if (punkt) break;
      }
    } catch (e) {
      console.error("Rozwinięcie linku Map Google nie przeszło:", e);
    }
  }

  if (!punkt) {
    return {
      blad:
        "Nie widzę współrzędnych w tym linku. W Mapach Google przytrzymaj palec na miejscu (pinezka), " +
        "skopiuj współrzędne z góry ekranu (np. 50.7781, 15.7563) i wklej je tutaj.",
    };
  }
  return { punkt: { lat: Math.round(punkt.lat * 1e6) / 1e6, lng: Math.round(punkt.lng * 1e6) / 1e6 }, link: url };
}
