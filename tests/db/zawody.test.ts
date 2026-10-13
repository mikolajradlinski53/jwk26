import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  makeAdmin,
  ustawJakoZaakceptowany,
  type TestUser,
} from "../helpers/supabase";

// Zawody (paczka D2): składy na Toplakyyy/siatkówkę, zapisy indywidualne,
// terminarz każdy z każdym.
type Gracz = { user: TestUser; klient: SupabaseClient };
let gracze: Gracz[] = [];
let czekajacy: TestUser;
let szef: Gracz;
const id: Record<string, string> = {};

beforeAll(async () => {
  const konta = await Promise.all(Array.from({ length: 8 }, (_, i) => createUser(`gracz-zawody-${i}`)));
  czekajacy = await createUser("czekajacy-zawody");
  const szefKonto = await createUser("szef-zawody");
  await makeAdmin(szefKonto);
  await Promise.all(konta.map((k, i) => ustawJakoZaakceptowany(k).then(() =>
    admin.from("profiles").update({ display_name: `Gracz ${i}` }).eq("id", k.id))));
  gracze = [];
  for (const k of konta) gracze.push({ user: k, klient: await signIn(k) });
  szef = { user: szefKonto, klient: await signIn(szefKonto) };
  const { data } = await admin.from("zawody").select("id, nazwa");
  for (const z of data ?? []) id[z.nazwa as string] = z.id as string;
  // Testy liczą na składy 5 (Toplakyyy) i 4 (siatkówka) - na produkcji jest
  // 4 i 6 (2026-10-13); przywracane w afterAll.
  await admin.from("zawody").update({ rozmiar_skladu: 5 }).eq("nazwa", "Toplakyyy");
  await admin.from("zawody").update({ rozmiar_skladu: 4 }).eq("nazwa", "Siatkówka");
}, 120_000);

afterEach(async () => {
  await admin.from("zawody_druzyny").delete().not("id", "is", null);
  await admin.from("zawody_zapisy").delete().not("user_id", "is", null);
  await admin.from("zawody").update({ zapisy_otwarte: false }).not("id", "is", null);
  await admin.from("zawody").update({ limit_miejsc: 10 }).eq("nazwa", "Poker");
  await admin.from("zawody").update({ limit_miejsc: 16 }).eq("nazwa", "Szachy");
  await admin.from("powiadomienia").delete().eq("ref_type", "zawody");
});

afterAll(async () => {
  await admin.from("zawody").update({ rozmiar_skladu: 4 }).eq("nazwa", "Toplakyyy");
  await admin.from("zawody").update({ rozmiar_skladu: 6 }).eq("nazwa", "Siatkówka");
  await Promise.all([...gracze.map((g) => g.user), czekajacy, szef.user].map(deleteUser));
});

const otworz = (nazwa: string, otwarte = true) =>
  admin.from("zawody").update({ zapisy_otwarte: otwarte }).eq("id", id[nazwa]);

function sklad(zalozyciel: Gracz, nazwa: string, czlonkowie: Gracz[], dziewczyna = true, zawody = "Toplakyyy") {
  return zalozyciel.klient.rpc("zapisz_druzyne", {
    p_zawody: id[zawody],
    p_nazwa: nazwa,
    p_czlonkowie: czlonkowie.map((c) => c.user.id),
    p_dziewczyna: dziewczyna,
  });
}

describe("składy na zawody drużynowe", () => {
  it("przy zamkniętych zapisach skład nie przejdzie", async () => {
    const { error } = await sklad(gracze[0], "Kozy", gracze.slice(1, 5));
    expect(error!.message).toMatch(/ZAPISY_ZAMKNIETE/);
  });

  it("Toplakyyy: pięć osób, dziewczyna potwierdzona, wszyscy przyjęci", async () => {
    await otworz("Toplakyyy");
    expect((await sklad(gracze[0], "Kozy", gracze.slice(1, 4))).error!.message).toMatch(/SKLAD_ROZMIAR/);
    expect((await sklad(gracze[0], "Kozy", gracze.slice(1, 5), false)).error!.message).toMatch(/SKLAD_BEZ_DZIEWCZYNY/);
    const zCzekajacym = await gracze[0].klient.rpc("zapisz_druzyne", {
      p_zawody: id.Toplakyyy,
      p_nazwa: "Kozy",
      p_czlonkowie: [...gracze.slice(1, 4).map((g) => g.user.id), czekajacy.id],
      p_dziewczyna: true,
    });
    expect(zCzekajacym.error!.message).toMatch(/SKLAD_NIEPRZYJETY/);

    const { data: druzynaId, error } = await sklad(gracze[0], "Kozy", gracze.slice(1, 5));
    expect(error).toBeNull();
    const { count } = await admin
      .from("zawody_sklad")
      .select("user_id", { count: "exact", head: true })
      .eq("druzyna_id", druzynaId as string);
    expect(count).toBe(5);

    // Czterech wpisanych dostaje push, zakładający nie.
    const { data: push } = await admin
      .from("powiadomienia")
      .select("adresat_id, body")
      .eq("ref_type", "zawody")
      .eq("ref_id", druzynaId as string);
    expect(push!.map((p) => p.adresat_id).sort()).toEqual(gracze.slice(1, 5).map((g) => g.user.id).sort());
    expect(push![0].body).toBe("Gracz 0 wpisuje Cię do składu „Kozy”. Nie grasz? Wypisz się w apce, póki trwają zapisy.");
  });

  it("ta sama osoba w drugim składzie jest odbita, z ksywkami zajętych", async () => {
    await otworz("Toplakyyy");
    expect((await sklad(gracze[0], "Kozy", gracze.slice(1, 5))).error).toBeNull();
    const zajety = await sklad(gracze[5], "Smoki", [gracze[4], gracze[6], gracze[7], gracze[1]]);
    expect(zajety.error!.message).toMatch(/SKLAD_ZAJETY: (Gracz 4, Gracz 1|Gracz 1, Gracz 4)/);
  });

  it("nazwa składu zajęta bez względu na wielkość liter i spacje", async () => {
    await otworz("Siatkówka");
    expect((await sklad(gracze[0], "Kozy", gracze.slice(1, 4), false, "Siatkówka")).error).toBeNull();
    const dubel = await sklad(gracze[4], "  kozy ", gracze.slice(5, 8), false, "Siatkówka");
    expect(dubel.error!.message).toMatch(/NAZWA_DRUZYNY_ZAJETA/);
  });

  it("dwa składy z tą samą osobą naraz: wchodzi jeden", async () => {
    await otworz("Siatkówka");
    const [a, b] = await Promise.all([
      sklad(gracze[0], "Lewi", [gracze[1], gracze[2], gracze[3]], false, "Siatkówka"),
      sklad(gracze[4], "Prawi", [gracze[5], gracze[6], gracze[3]], false, "Siatkówka"),
    ]);
    expect([a.error, b.error].filter(Boolean)).toHaveLength(1);
    expect((a.error ?? b.error)!.message).toMatch(/SKLAD_ZAJETY: Gracz 3/);
  });

  it("wpisany może się wypisać, zakładający dobiera zastępstwo; obcy nie dobierze", async () => {
    await otworz("Siatkówka");
    const { data: d } = await sklad(gracze[0], "Lewi", [gracze[1], gracze[2], gracze[3]], false, "Siatkówka");
    expect((await gracze[3].klient.rpc("wypisz_sie_z_zawodow", { p_zawody: id["Siatkówka"] })).error).toBeNull();

    const { data: push } = await admin
      .from("powiadomienia")
      .select("adresat_id, tytul")
      .eq("ref_type", "zawody")
      .eq("adresat_id", gracze[0].user.id);
    expect(push!.map((p) => p.tytul)).toContain("Ktoś opuszcza skład: Siatkówka");

    const obcy = await gracze[1].klient.rpc("dodaj_do_skladu", { p_druzyna: d, p_user: gracze[4].user.id });
    expect(obcy.error!.message).toMatch(/osoba, ktora go zapisala/);
    expect((await gracze[0].klient.rpc("dodaj_do_skladu", { p_druzyna: d, p_user: gracze[4].user.id })).error).toBeNull();
    const pelny = await gracze[0].klient.rpc("dodaj_do_skladu", { p_druzyna: d, p_user: gracze[5].user.id });
    expect(pelny.error!.message).toMatch(/pelny/);
  });

  it("zakładający, który się wypisuje, rozwiązuje skład", async () => {
    await otworz("Siatkówka");
    const { data: d } = await sklad(gracze[0], "Lewi", [gracze[1], gracze[2], gracze[3]], false, "Siatkówka");
    expect((await gracze[0].klient.rpc("wypisz_sie_z_zawodow", { p_zawody: id["Siatkówka"] })).error).toBeNull();
    const { data } = await admin.from("zawody_druzyny").select("id").eq("id", d as string);
    expect(data).toEqual([]);
  });

  it("po zamknięciu zapisów nikt się nie wypisze", async () => {
    await otworz("Siatkówka");
    await sklad(gracze[0], "Lewi", [gracze[1], gracze[2], gracze[3]], false, "Siatkówka");
    await otworz("Siatkówka", false);
    const { error } = await gracze[1].klient.rpc("wypisz_sie_z_zawodow", { p_zawody: id["Siatkówka"] });
    expect(error!.message).toMatch(/ZAPISY_ZAMKNIETE/);
  });

  it("uczestnik nie zmieni zawodów ani składów bezpośrednio", async () => {
    await gracze[0].klient.from("zawody").update({ zapisy_otwarte: true }).eq("id", id.Toplakyyy);
    const { data } = await admin.from("zawody").select("zapisy_otwarte").eq("id", id.Toplakyyy).single();
    expect(data!.zapisy_otwarte).toBe(false);
    const { error } = await gracze[0].klient
      .from("zawody_druzyny")
      .insert({ zawody_id: id.Toplakyyy, nazwa: "Wjazd bokiem", zalozyciel_id: gracze[0].user.id });
    expect(error).not.toBeNull();
  });
});

describe("zapisy indywidualne", () => {
  it("limit miejsc, ponowny zapis bez dubla, wypisanie zwalnia miejsce", async () => {
    await admin.from("zawody").update({ zapisy_otwarte: true, limit_miejsc: 2 }).eq("id", id.Poker);
    const zapisz = (g: Gracz) => g.klient.rpc("zapisz_sie_na_zawody", { p_zawody: id.Poker });
    expect((await zapisz(gracze[0])).error).toBeNull();
    expect((await zapisz(gracze[0])).error).toBeNull();
    expect((await zapisz(gracze[1])).error).toBeNull();
    expect((await zapisz(gracze[2])).error!.message).toMatch(/ZAWODY_PELNE/);
    expect((await gracze[1].klient.rpc("wypisz_sie_z_zawodow", { p_zawody: id.Poker })).error).toBeNull();
    expect((await zapisz(gracze[2])).error).toBeNull();
    const { count } = await admin
      .from("zawody_zapisy")
      .select("user_id", { count: "exact", head: true })
      .eq("zawody_id", id.Poker);
    expect(count).toBe(2);
  });

  it("ostatnie miejsce naraz: wchodzi jeden", async () => {
    await admin.from("zawody").update({ zapisy_otwarte: true, limit_miejsc: 1 }).eq("id", id.Szachy);
    const wyniki = await Promise.all(
      gracze.slice(0, 5).map((g) => g.klient.rpc("zapisz_sie_na_zawody", { p_zawody: id.Szachy })),
    );
    expect(wyniki.filter((w) => w.error === null)).toHaveLength(1);
    for (const w of wyniki.filter((w) => w.error)) expect(w.error!.message).toMatch(/ZAWODY_PELNE/);
  });
});

describe("terminarz każdy z każdym", () => {
  async function skladyNaSiatkowke(ile: number) {
    await otworz("Siatkówka");
    // Siatkówka: 4 osoby, z 8 graczy da się zrobić 2 składy - kolejne zakłada admin.
    const druzyny: string[] = [];
    for (let i = 0; i < ile; i++) {
      const { data, error } = await admin
        .from("zawody_druzyny")
        .insert({ zawody_id: id["Siatkówka"], nazwa: `Skład ${i}`, zalozyciel_id: gracze[i].user.id })
        .select("id")
        .single();
      if (error) throw error;
      druzyny.push(data.id as string);
    }
    await otworz("Siatkówka", false);
    return druzyny;
  }

  it("uczestnik nie ułoży, przy otwartych zapisach też nie", async () => {
    await skladyNaSiatkowke(3);
    expect((await gracze[0].klient.rpc("uloz_mecze", { p_zawody: id["Siatkówka"] })).error).not.toBeNull();
    await otworz("Siatkówka");
    const { error } = await szef.klient.rpc("uloz_mecze", { p_zawody: id["Siatkówka"] });
    expect(error!.message).toMatch(/zamknij zapisy/);
  });

  for (const ile of [2, 3, 4, 5, 6]) {
    it(`${ile} składów: każda para raz, nikt dwa razy w rundzie`, async () => {
      const druzyny = await skladyNaSiatkowke(ile);
      const { data: ilosc, error } = await szef.klient.rpc("uloz_mecze", { p_zawody: id["Siatkówka"] });
      expect(error).toBeNull();
      expect(ilosc).toBe((ile * (ile - 1)) / 2);

      const { data: mecze } = await admin
        .from("zawody_mecze")
        .select("runda, druzyna_a, druzyna_b")
        .eq("zawody_id", id["Siatkówka"]);
      const pary = new Set(mecze!.map((m) => [m.druzyna_a, m.druzyna_b].sort().join("|")));
      expect(pary.size).toBe((ile * (ile - 1)) / 2);
      for (const d of druzyny) expect(mecze!.filter((m) => m.druzyna_a === d || m.druzyna_b === d)).toHaveLength(ile - 1);
      const rundy = new Map<number, string[]>();
      for (const m of mecze!) rundy.set(m.runda, [...(rundy.get(m.runda) ?? []), m.druzyna_a, m.druzyna_b]);
      for (const grajacy of rundy.values()) expect(new Set(grajacy).size).toBe(grajacy.length);
      expect(Math.max(...rundy.keys())).toBe(ile % 2 === 0 ? ile - 1 : ile);
    });
  }

  it("po wpisaniu wyniku terminarza nie da się ułożyć od nowa", async () => {
    await skladyNaSiatkowke(3);
    await szef.klient.rpc("uloz_mecze", { p_zawody: id["Siatkówka"] });
    const { data: m } = await admin.from("zawody_mecze").select("id").eq("zawody_id", id["Siatkówka"]).limit(1).single();
    expect((await szef.klient.from("zawody_mecze").update({ wynik_a: 2, wynik_b: 1 }).eq("id", m!.id)).error).toBeNull();
    const { error } = await szef.klient.rpc("uloz_mecze", { p_zawody: id["Siatkówka"] });
    expect(error!.message).toMatch(/MECZE_MAJA_WYNIKI/);
  });
});
