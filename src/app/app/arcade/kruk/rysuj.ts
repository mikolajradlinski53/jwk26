import { KRUK_R, KRUK_X, SWIAT, SZCZELINA, SZER_KOLUMNY, type Stan } from "@/lib/kruk/fizyka";

export type Paleta = { noc: string; kosc: string; dym: string; krew: string; font: string };

export type ObrazyGry = { tlo: HTMLImageElement; kolumna: HTMLImageElement; klatki: HTMLImageElement[] };

/** Wczytuje grafiki gry; odrzuca, jeśli którakolwiek się nie wczyta. */
export async function wczytajObrazy(): Promise<ObrazyGry> {
  const zaladuj = (src: string) =>
    new Promise<HTMLImageElement>((ok, zle) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = zle;
      i.src = src;
    });
  const [tlo, kolumna, ...klatki] = await Promise.all([
    zaladuj("/grafika/kruk/tlo.webp"),
    zaladuj("/grafika/kruk/kolumna.webp"),
    ...[1, 2, 3, 4, 5, 6].map((n) => zaladuj(`/grafika/kruk/klatka-${n}.webp`)),
  ]);
  return { tlo, kolumna, klatki };
}

// Geometria grafik w pikselach źródła (spec wyglądu §4, pomiar w planie 15a).
const KOLUMNA_TRZON_PX = 106; // szerokość trzonu u góry
const KOLUMNA_KAPITEL_PX = 80; // abakus, echinus i pierścień szyi
const KOLUMNA_TRZON_DO_PX = 300; // górny, prosty odcinek trzonu - niżej trzon się rozszerza
const KLATKA_W = 480;
const KLATKA_H = 475;
const KLATKA_DZIOB_Y = 356; // czubek dzioba w klatce (klatki wyrównane do dzioba)
const KRUK_SKALA = 0.16; // ~77 jednostek szerokości na ekranie
const DZIOB_PRZED_SRODKIEM = 30; // odległość czubka dzioba od środka kolizji
// Cykl machnięcia z 6 klatek z przenikaniem (spec wyglądu, D4).
const CYKL = [1, 6, 2, 3, 5, 2, 6].map((n) => n - 1);
const KLATKA_MS = 120;

/**
 * Jedna klatka w jednostkach świata - skalę pod ekran ustawia wywołujący
 * przez setTransform. Z grafikami, gdy są wczytane; do tego czasu wersja
 * wektorowa, żeby słaba sieć niczego nie blokowała.
 */
export function rysuj(
  ctx: CanvasRenderingContext2D,
  s: Stan,
  p: Paleta,
  o: { czas: number; unosi: boolean; pokazWynik: boolean },
  obrazy: ObrazyGry | null,
): void {
  if (obrazy) rysujGrafiki(ctx, s, o, obrazy);
  else rysujWektor(ctx, s, p, o);

  if (o.pokazWynik) {
    ctx.fillStyle = p.kosc;
    ctx.font = `bold 44px ${p.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(s.wynik), SWIAT.szer / 2, 24);
  }
}

function rysujGrafiki(
  ctx: CanvasRenderingContext2D,
  s: Stan,
  o: { czas: number; unosi: boolean },
  obrazy: ObrazyGry,
): void {
  // Tło: Nawa, „cover” na świat 360 × 480, przyciemniona o ~25%.
  const t = obrazy.tlo;
  const skalaT = Math.max(SWIAT.szer / t.width, SWIAT.wys / t.height);
  const tw = t.width * skalaT;
  const th = t.height * skalaT;
  ctx.drawImage(t, (SWIAT.szer - tw) / 2, (SWIAT.wys - th) / 2, tw, th);
  ctx.fillStyle = "rgb(12 7 9 / 0.25)";
  ctx.fillRect(0, 0, SWIAT.szer, SWIAT.wys);

  // Kolumny: kapitel stały, trzon rozciągnięty; górna to odbicie dolnej.
  const k = obrazy.kolumna;
  const sk = SZER_KOLUMNY / KOLUMNA_TRZON_PX;
  const kw = k.width * sk;
  const kh = KOLUMNA_KAPITEL_PX * sk;
  const trzon = KOLUMNA_TRZON_DO_PX - KOLUMNA_KAPITEL_PX;
  for (const kol of s.kolumny) {
    const gora = kol.srodek - SZCZELINA / 2;
    const dol = kol.srodek + SZCZELINA / 2;
    const x0 = kol.x + SZER_KOLUMNY / 2 - kw / 2;
    ctx.drawImage(k, 0, 0, k.width, KOLUMNA_KAPITEL_PX, x0, dol, kw, kh);
    ctx.drawImage(k, 0, KOLUMNA_KAPITEL_PX, k.width, trzon, x0, dol + kh, kw, Math.max(0, SWIAT.wys - dol - kh));
    ctx.save();
    ctx.translate(0, gora);
    ctx.scale(1, -1);
    ctx.drawImage(k, 0, 0, k.width, KOLUMNA_KAPITEL_PX, x0, 0, kw, kh);
    ctx.drawImage(k, 0, KOLUMNA_KAPITEL_PX, k.width, trzon, x0, kh, kw, Math.max(0, gora - kh));
    ctx.restore();
  }

  // Kruk: przenikanie sąsiednich klatek cyklu, pochylenie wg prędkości.
  const f = ((o.czas * 1000) / KLATKA_MS) % CYKL.length;
  const i = Math.floor(f);
  const a = obrazy.klatki[CYKL[i]];
  const b = obrazy.klatki[CYKL[(i + 1) % CYKL.length]];
  const y = o.unosi ? s.y + Math.sin(o.czas * 3) * 6 : s.y;
  const kat = o.unosi ? 0 : Math.max(-0.5, Math.min(1.2, s.vy / 600));
  const w = KLATKA_W * KRUK_SKALA;
  const h = KLATKA_H * KRUK_SKALA;
  const dx = DZIOB_PRZED_SRODKIEM - w;
  const dy = -KLATKA_DZIOB_Y * KRUK_SKALA;
  ctx.save();
  ctx.translate(KRUK_X, y);
  ctx.rotate(kat);
  ctx.drawImage(a, dx, dy, w, h);
  ctx.globalAlpha = f - i;
  ctx.drawImage(b, dx, dy, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Wersja wektorowa - rysowana, dopóki grafiki się nie wczytają. */
function rysujWektor(
  ctx: CanvasRenderingContext2D,
  s: Stan,
  p: Paleta,
  o: { czas: number; unosi: boolean },
): void {
  ctx.fillStyle = p.noc;
  ctx.fillRect(0, 0, SWIAT.szer, SWIAT.wys);

  for (const k of s.kolumny) {
    const gora = k.srodek - SZCZELINA / 2;
    const dol = k.srodek + SZCZELINA / 2;
    ctx.fillStyle = p.dym;
    ctx.fillRect(k.x, 0, SZER_KOLUMNY, gora);
    ctx.fillRect(k.x, dol, SZER_KOLUMNY, SWIAT.wys - dol);
    // Kapitele - szerszy blok na końcu każdej kolumny, od strony szczeliny.
    ctx.fillStyle = p.kosc;
    ctx.fillRect(k.x - 4, gora - 10, SZER_KOLUMNY + 8, 10);
    ctx.fillRect(k.x - 4, dol, SZER_KOLUMNY + 8, 10);
  }

  // Przed startem kruk unosi się w miejscu; w locie pochyla się z prędkością.
  const y = o.unosi ? s.y + Math.sin(o.czas * 3) * 6 : s.y;
  const kat = o.unosi ? 0 : Math.max(-0.5, Math.min(1.2, s.vy / 600));
  const skrzydloWGorze = o.unosi ? Math.sin(o.czas * 10) > 0 : s.vy < 0;

  ctx.save();
  ctx.translate(KRUK_X, y);
  ctx.rotate(kat);
  // Czarny kruk na prawie czarnym tle - widać go dzięki obrysowi w kolorze kości.
  ctx.fillStyle = "#000";
  ctx.strokeStyle = p.kosc;
  ctx.lineWidth = 1.5;

  ctx.beginPath(); // ogon
  ctx.moveTo(-10, 0);
  ctx.lineTo(-22, -5);
  ctx.lineTo(-22, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath(); // tułów
  ctx.ellipse(0, 0, KRUK_R + 2, KRUK_R - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath(); // skrzydło
  ctx.moveTo(-6, -1);
  ctx.lineTo(4, -1);
  ctx.lineTo(-4, skrzydloWGorze ? -14 : 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = p.dym; // dziób
  ctx.beginPath();
  ctx.moveTo(KRUK_R + 1, -3);
  ctx.lineTo(KRUK_R + 10, 0);
  ctx.lineTo(KRUK_R + 1, 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.krew; // oko
  ctx.beginPath();
  ctx.arc(6, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
