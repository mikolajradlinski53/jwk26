import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

type Paczka = {
  id: number;
  tytul: string;
  tresc: string | null;
  link: string;
  subskrypcje: { endpoint: string; p256dh: string; auth: string }[];
}[];

function tenSamSekret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Wysyłka powiadomień push. Wołana przez bazę (pg_net po wstawieniu wiersza
 * do `powiadomienia` i pg_cron co minutę) z sekretem w nagłówku.
 *
 * Bez klucza serwisowego: paczkę i oznaczenie robią funkcje w bazie
 * (pobierz_push, oznacz_push), które same sprawdzają ten sam sekret —
 * trasa ma tylko klucz anon, jak skrypt arkusza.
 */
export async function POST(request: Request) {
  // `trim()`: wklejony do Vercela sekret łatwo łapie spację albo znak nowej
  // linii, a wtedy każde wywołanie z bazy kończy się 401 bez żadnej podpowiedzi.
  const sekret = process.env.PUSH_SEKRET?.trim();
  const publiczny = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const prywatny = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!sekret || !publiczny || !prywatny) {
    return new Response("Wysyłka nieskonfigurowana", { status: 503 });
  }
  if (!tenSamSekret(request.headers.get("x-push-sekret") ?? "", sekret)) {
    return new Response("Brak dostępu", { status: 401 });
  }

  webpush.setVapidDetails("mailto:samorzad@samorzad.ue.wroc.pl", publiczny, prywatny);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.rpc("pobierz_push", { p_sekret: sekret });
  if (error) {
    console.error("Pobranie paczki push nie przeszło:", { code: error.code, message: error.message });
    return new Response("Błąd bazy", { status: 500 });
  }

  const paczka = (data ?? []) as Paczka;

  for (const p of paczka) {
    const wyniki = await Promise.allSettled(
      p.subskrypcje.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ id: p.id, tytul: p.tytul, tresc: p.tresc, link: p.link }),
          {
            // Godzina: powiadomienie o zbiórce sprzed trzech godzin jest gorsze
            // niż żadne — telefon offline dłużej go już nie dostanie.
            TTL: 3600,
            // Wysoki priorytet: Android nie odkłada wtedy dostarczenia do
            // wybudzenia z trybu oszczędzania baterii (Doze), tylko budzi
            // telefon od razu. To jedyna rzecz po stronie serwera, która
            // decyduje, czy powiadomienie przyjdzie „teraz", czy „kiedyś".
            urgency: "high",
          },
        ),
      ),
    );

    // 404 i 410 znaczą „tej subskrypcji już nie ma" — telefon się wypisał
    // albo apka zniknęła. Inne błędy (np. chwilowe 5xx) zostawiają adres.
    const martwe = wyniki.flatMap((w, i) => {
      if (w.status !== "rejected") return [];
      const kod = (w.reason as { statusCode?: number })?.statusCode;
      return kod === 404 || kod === 410 ? [p.subskrypcje[i].endpoint] : [];
    });
    const wyslane = wyniki.filter((w) => w.status === "fulfilled").length;

    const { error: bladOznaczenia } = await supabase.rpc("oznacz_push", {
      p_sekret: sekret,
      p_id: p.id,
      p_wyslane: wyslane,
      p_martwe: martwe,
    });
    if (bladOznaczenia) {
      console.error("Oznaczenie push nie przeszło:", {
        code: bladOznaczenia.code,
        message: bladOznaczenia.message,
      });
    }
  }

  return Response.json({ powiadomien: paczka.length });
}
