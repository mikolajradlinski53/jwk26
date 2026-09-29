import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { numeryDoWysylki, trescSms } from "@/lib/sms";

type Paczka = { id: number; tytul: string; tresc: string | null; numery: string[] }[];

type OdpowiedzSmsapi =
  | { count: number; list: { id: string; number: string; status: string }[] }
  | { error: number; message: string };

function tenSamSekret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Wysyłka SMS-ów przez SMSAPI. Wołana przez bazę (pg_net po wstawieniu
 * wiersza z kanałem `sms`, pg_cron co minutę) z sekretem w nagłówku —
 * dokładnie jak /api/push, i tak samo bez klucza serwisowego.
 *
 * Konfiguracja (docs/sms.md): SMS_SEKRET (= sekrety.sms), SMSAPI_TOKEN;
 * opcjonalnie SMSAPI_NADAWCA (zarejestrowana nazwa nadawcy) i SMSAPI_TEST=1
 * (SMSAPI przyjmuje żądanie, ale nic nie wysyła i nie pobiera opłat).
 */
export async function POST(request: Request) {
  const sekret = process.env.SMS_SEKRET?.trim();
  const token = process.env.SMSAPI_TOKEN?.trim();
  if (!sekret || !token) {
    return new Response("Wysyłka SMS nieskonfigurowana", { status: 503 });
  }
  if (!tenSamSekret(request.headers.get("x-sms-sekret") ?? "", sekret)) {
    return new Response("Brak dostępu", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.rpc("pobierz_sms", { p_sekret: sekret });
  if (error) {
    console.error("Pobranie paczki SMS nie przeszło:", { code: error.code, message: error.message });
    return new Response("Błąd bazy", { status: 500 });
  }

  const nadawca = process.env.SMSAPI_NADAWCA?.trim();
  const test = process.env.SMSAPI_TEST?.trim() === "1";
  const paczka = (data ?? []) as Paczka;
  let wyslanych = 0;

  for (const p of paczka) {
    const numery = numeryDoWysylki(p.numery);
    let wyslane = 0;

    if (numery.length > 0) {
      const parametry = new URLSearchParams({
        to: numery.join(","),
        message: trescSms(p.tytul, p.tresc),
        format: "json",
        encoding: "utf-8",
        // Polskie znaki zamienione na łacińskie: SMS mieści wtedy 160 znaków
        // zamiast 70, czyli ogłoszenie kosztuje 2–3 razy mniej części.
        normalize: "1",
      });
      if (nadawca) parametry.set("from", nadawca);
      if (test) parametry.set("test", "1");

      let odpowiedz: OdpowiedzSmsapi;
      try {
        const r = await fetch("https://api.smsapi.pl/sms.do", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: parametry,
        });
        odpowiedz = (await r.json()) as OdpowiedzSmsapi;
      } catch (e) {
        // Bez oznaczenia: pg_cron spróbuje jeszcze raz (najwyżej pięć razy, przez godzinę).
        console.error("SMSAPI nie odpowiedziało:", e);
        continue;
      }

      if ("error" in odpowiedz) {
        console.error("SMSAPI odrzuciło wysyłkę:", { kod: odpowiedz.error, opis: odpowiedz.message, id: p.id });
        continue;
      }
      wyslane = odpowiedz.count ?? odpowiedz.list?.length ?? 0;
    }

    const { error: bladOznaczenia } = await supabase.rpc("oznacz_sms", {
      p_sekret: sekret,
      p_id: p.id,
      p_wyslane: wyslane,
    });
    if (bladOznaczenia) {
      console.error("Oznaczenie SMS nie przeszło:", { code: bladOznaczenia.code, message: bladOznaczenia.message });
    }
    wyslanych += wyslane;
  }

  return Response.json({ powiadomien: paczka.length, sms: wyslanych, test });
}
