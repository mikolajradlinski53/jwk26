import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  ustawPule,
  ustawUstawienie,
  daneZapisu,
  sprzatanieUzytkownikow,
  type TestUser,
} from "../helpers/supabase";

// Organizatorzy dostają maila przy każdym zgłoszeniu i osobnego, gdy tura
// się zapełni. Na bazie testowej klucz Resend jest pusty, więc nic nie
// wychodzi - sprawdzamy dziennik `maile_zgloszen_log`, który powstaje zawsze.
const { nowyUzytkownik, posprzataj } = sprzatanieUzytkownikow();

// Granica po identyfikatorze, nie po czasie: zegar komputera i bazy mogą się
// rozjechać o kilka sekund.
let odId = 0;
const osoby: { user: TestUser; client: SupabaseClient }[] = [];

beforeAll(async () => {
  await ustawUstawienie("regulamin_zatwierdzony", true);
  await ustawPule("dzialacze", true, 1);
  for (const tag of ["mail-pierwsza", "mail-druga"]) {
    const user = await nowyUzytkownik(tag);
    osoby.push({ user, client: await signIn(user) });
  }
});

afterEach(async () => {
  await admin.from("registrations").delete().in("user_id", osoby.map((o) => o.user.id));
  await admin.from("maile_zgloszen_log").delete().gt("id", odId);
});

afterAll(async () => {
  await ustawPule("dzialacze", false, 0);
  await ustawUstawienie("regulamin_zatwierdzony", false);
  await posprzataj();
});

function zloz(o: { user: TestUser; client: SupabaseClient }, naRezerwe = false) {
  return o.client.rpc("zloz_zgloszenie", {
    p_dane: daneZapisu(),
    p_wrazliwe: null,
    p_proof_path: naRezerwe ? null : `${o.user.id}/dowod.jpg`,
    p_na_rezerwe: naRezerwe,
  });
}

async function ostatnieId(): Promise<number> {
  const { data, error } = await admin.from("maile_zgloszen_log").select("id").order("id", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0]?.id as number | undefined) ?? 0;
}

async function dziennik(po: number) {
  const { data, error } = await admin
    .from("maile_zgloszen_log")
    .select("rodzaj, temat, tresc, wyslany")
    .gt("id", po)
    .order("id");
  if (error) throw error;
  return data ?? [];
}

describe("maile o zgłoszeniach", () => {
  it("zgłoszenie zajmujące ostatnie miejsce daje mail o zgłoszeniu i o pełnej turze", async () => {
    odId = await ostatnieId();
    expect((await zloz(osoby[0])).error).toBeNull();
    const maile = await dziennik(odId);
    expect(maile.map((m) => m.rodzaj)).toEqual(["zgloszenie", "pula_pelna"]);
    expect(maile[0].tresc).toMatch(/Brat Testowy/);
    expect(maile[0].tresc).toMatch(/lista główna \(zajęte 1 z 1 miejsc\)/);
    expect(maile[1].temat).toMatch(/Działacze zapełniona/);
    // Bez klucza i adresów nic nie wychodzi - tak ma być na bazie testowej.
    expect(maile.every((m) => m.wyslany === false)).toBe(true);
  });

  it("zgłoszenie na rezerwę daje tylko mail o zgłoszeniu", async () => {
    odId = await ostatnieId();
    expect((await zloz(osoby[0])).error).toBeNull();
    const poPierwszym = await ostatnieId();
    expect((await zloz(osoby[1], true)).error).toBeNull();
    const maile = await dziennik(poPierwszym);
    expect(maile.map((m) => m.rodzaj)).toEqual(["zgloszenie"]);
    expect(maile[0].tresc).toMatch(/lista rezerwowa/);
  });

  it("zwykły uczestnik nie czyta dziennika maili", async () => {
    const { data } = await osoby[0].client.from("maile_zgloszen_log").select("id");
    expect(data ?? []).toEqual([]);
  });
});
