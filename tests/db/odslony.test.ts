import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  anonimowy,
  signIn,
  ustawUstawienie,
  ustawJakoZaakceptowany,
  sprzatanieUzytkownikow,
} from "../helpers/supabase";

const { nowyUzytkownik, nowyAdmin, posprzataj } = sprzatanieUzytkownikow();

const PRZYSZLOSC = "2099-01-01T12:00:00+01:00";
const PRZESZLOSC = "2020-01-01T12:00:00+01:00";
const DOMYSLNE = {
  odslona_osrodek: "2026-10-05T18:00:00+02:00",
  odslona_cena: "2026-10-08T18:00:00+02:00",
  odslona_zapisy: "2026-10-12T18:00:00+02:00",
};

let uczestnik: SupabaseClient;
let szef: SupabaseClient;
let poprzedniaKwota: unknown = null;

async function odslony(osrodek: string, cena: string, zapisy: string) {
  await ustawUstawienie("odslona_osrodek", osrodek);
  await ustawUstawienie("odslona_cena", cena);
  await ustawUstawienie("odslona_zapisy", zapisy);
}

async function widzi(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client
    .from("app_settings")
    .select("key")
    .in("key", ["miejsce_nazwa", "miejsce_adres", "przelew_kwota", "data_jwk", "odslona_osrodek", "social_instagram"]);
  if (error) throw error;
  return new Set((data ?? []).map((w) => w.key as string));
}

beforeAll(async () => {
  const { data } = await admin.from("app_settings").select("value").eq("key", "przelew_kwota").maybeSingle();
  poprzedniaKwota = data?.value ?? null;
  // Klucz musi istnieć - inaczej „nie widzi” przechodziłoby na pustej tabeli.
  await ustawUstawienie("przelew_kwota", 320);

  const u = await nowyUzytkownik("odslony-uczestnik");
  await ustawJakoZaakceptowany(u);
  const a = await nowyAdmin("odslony-szef");
  uczestnik = await signIn(u);
  szef = await signIn(a);
});

afterAll(async () => {
  for (const [k, v] of Object.entries(DOMYSLNE)) await ustawUstawienie(k, v);
  await ustawUstawienie("odslona_plan", "2026-10-23T14:00:00+02:00");
  if (poprzedniaKwota === null) await admin.from("app_settings").delete().eq("key", "przelew_kwota");
  else await ustawUstawienie("przelew_kwota", poprzedniaKwota);
  await ustawUstawienie("social_instagram", "");
  await posprzataj();
});

describe("zasłony w bazie", () => {
  it("przed datami niezalogowany nie czyta miejsca ani kwoty, ale czyta daty odsłon", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZYSZLOSC);
    const w = await widzi(anonimowy());
    expect(w.has("miejsce_nazwa")).toBe(false);
    expect(w.has("miejsce_adres")).toBe(false);
    expect(w.has("przelew_kwota")).toBe(false);
    expect(w.has("data_jwk")).toBe(true);
    expect(w.has("odslona_osrodek")).toBe(true);
    expect(w.has("social_instagram")).toBe(true);
  });

  it("po dacie ośrodka widać miejsce, kwota dalej zakryta", async () => {
    await odslony(PRZESZLOSC, PRZYSZLOSC, PRZYSZLOSC);
    const w = await widzi(anonimowy());
    expect(w.has("miejsce_nazwa")).toBe(true);
    expect(w.has("przelew_kwota")).toBe(false);
  });

  it("odsłona zapisów odsłania wszystko", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZESZLOSC);
    const w = await widzi(anonimowy());
    expect(w.has("miejsce_nazwa")).toBe(true);
    expect(w.has("przelew_kwota")).toBe(true);
  });

  it("zalogowany uczestnik jak niezalogowany; admin widzi zawsze", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZYSZLOSC);
    expect((await widzi(uczestnik)).has("miejsce_nazwa")).toBe(false);
    const s = await widzi(szef);
    expect(s.has("miejsce_nazwa")).toBe(true);
    expect(s.has("przelew_kwota")).toBe(true);
  });

  it("odslony() podaje stan i daty; pusta data znaczy odsłonięte", async () => {
    await odslony("", PRZYSZLOSC, PRZYSZLOSC);
    const { data, error } = await anonimowy().rpc("odslony");
    expect(error).toBeNull();
    const o = data as Record<string, { data: string | null; odsloniete: boolean }>;
    expect(o.osrodek).toEqual({ data: null, odsloniete: true });
    expect(o.cena.odsloniete).toBe(false);
    expect(new Date(o.cena.data!).getTime()).toBe(new Date(PRZYSZLOSC).getTime());
  });

  it("plan ma własny termin - odsłona zapisów go nie odsłania", async () => {
    await odslony(PRZYSZLOSC, PRZYSZLOSC, PRZESZLOSC);
    await ustawUstawienie("odslona_plan", PRZYSZLOSC);
    const { data } = await anonimowy().rpc("odslony");
    const o = data as Record<string, { odsloniete: boolean }>;
    expect(o.cena.odsloniete).toBe(true);
    expect(o.plan.odsloniete).toBe(false);
    await ustawUstawienie("odslona_plan", PRZESZLOSC);
    const { data: po } = await anonimowy().rpc("odslony");
    expect((po as Record<string, { odsloniete: boolean }>).plan.odsloniete).toBe(true);
  });

  it("adres social tylko z właściwej domeny albo pusty", async () => {
    await expect(ustawUstawienie("social_instagram", "https://evil.example/jwk")).rejects.toBeTruthy();
    await expect(ustawUstawienie("social_instagram", "https://www.facebook.com/jwk")).rejects.toBeTruthy();
    await ustawUstawienie("social_instagram", "https://www.instagram.com/jwk26/");
    await ustawUstawienie("social_instagram", "");
  });
});
