import { describe, it, expect } from "vitest";
import {
  KROK_S,
  KRUK_R,
  KRUK_X,
  ODSTEP_KOLUMN_S,
  PREDKOSC,
  SWIAT,
  SZER_KOLUMNY,
  krok,
  limitWyniku,
  nowyStan,
  type Stan,
} from "@/lib/kruk/fizyka";

// Szczelina zawsze na środku planszy — kruk trzymany na tej wysokości nigdy nie uderza.
const srodek = () => 0.5;
const bezKolumn = (s: Stan): Stan => ({ ...s, kolumny: [], doNastepnej: 999 });
/** Krok, po którym kruk wraca na środek — test samych kolumn, bez sterowania. */
const unosSie = (s: Stan): Stan => ({ ...krok(s, KROK_S, false, srodek), y: SWIAT.wys / 2, vy: 0 });

describe("lot", () => {
  it("bez machnięcia kruk opada", () => {
    let s = bezKolumn(nowyStan());
    for (let i = 0; i < 20; i++) s = krok(s, KROK_S, false, srodek);
    expect(s.y).toBeGreaterThan(SWIAT.wys / 2);
    expect(s.rozbity).toBe(false);
  });

  it("machnięcie podrywa kruka", () => {
    let s = krok(bezKolumn(nowyStan()), KROK_S, true, srodek);
    expect(s.vy).toBeLessThan(0);
    for (let i = 0; i < 5; i++) s = krok(s, KROK_S, false, srodek);
    expect(s.y).toBeLessThan(SWIAT.wys / 2);
  });

  it("sufit i ziemia kończą lot", () => {
    const sufit = krok({ ...bezKolumn(nowyStan()), y: KRUK_R, vy: -300 }, KROK_S, false, srodek);
    const ziemia = krok({ ...bezKolumn(nowyStan()), y: SWIAT.wys - KRUK_R, vy: 300 }, KROK_S, false, srodek);
    expect(sufit.rozbity).toBe(true);
    expect(ziemia.rozbity).toBe(true);
  });

  it("rozbity stan się nie zmienia", () => {
    const s = { ...nowyStan(), rozbity: true };
    expect(krok(s, KROK_S, true, srodek)).toBe(s);
  });
});

describe("kolumny", () => {
  it("kolumna poza szczeliną rozbija kruka", () => {
    // Szczelina u góry (środek 110), kruk nisko, kolumna na jego wysokości.
    const s: Stan = {
      ...bezKolumn(nowyStan()),
      y: 400,
      kolumny: [{ x: KRUK_X - 20, srodek: 110, minieta: false }],
    };
    expect(krok(s, KROK_S, false, srodek).rozbity).toBe(true);
  });

  it("przelot przez szczelinę dolicza dokładnie jeden punkt", () => {
    // Prawa krawędź kolumny o włos przed krukiem; po jednym kroku jest już za nim.
    let s: Stan = {
      ...bezKolumn(nowyStan()),
      kolumny: [{ x: KRUK_X - KRUK_R - SZER_KOLUMNY + 1, srodek: SWIAT.wys / 2, minieta: false }],
    };
    s = krok(s, KROK_S, false, srodek);
    expect(s.rozbity).toBe(false);
    expect(s.wynik).toBe(1);
    s = krok(s, KROK_S, false, srodek);
    expect(s.wynik).toBe(1);
  });

  it("kolumny stoją w równych odstępach", () => {
    let s = nowyStan();
    for (let i = 0; i < 300; i++) s = unosSie(s);
    const xs = s.kolumny.map((k) => k.x);
    expect(xs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeCloseTo(ODSTEP_KOLUMN_S * PREDKOSC, 6);
    }
  });

  it("wynik nigdy nie przekracza limitu z bazy, a limit jest ciasny", () => {
    let s = nowyStan();
    for (let i = 0; i < 60 * 60; i++) {
      s = unosSie(s);
      expect(s.rozbity).toBe(false);
      expect(s.wynik).toBeLessThanOrEqual(limitWyniku(s.czas));
    }
    // Minuta lotu: ok. 39 kolumn przy limicie 41.
    expect(s.wynik).toBeGreaterThan(30);
    expect(limitWyniku(s.czas) - s.wynik).toBeLessThanOrEqual(2);
  });
});
