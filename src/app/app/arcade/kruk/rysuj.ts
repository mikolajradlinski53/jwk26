import { KRUK_R, KRUK_X, SWIAT, SZCZELINA, SZER_KOLUMNY, type Stan } from "@/lib/kruk/fizyka";

export type Paleta = { noc: string; kosc: string; dym: string; krew: string; font: string };

/**
 * Jedna klatka w jednostkach świata — skalę pod ekran ustawia wywołujący
 * przez setTransform. Surowo: prostokąty i trójkąty, dopracowanie w planie 15.
 */
export function rysuj(
  ctx: CanvasRenderingContext2D,
  s: Stan,
  p: Paleta,
  o: { czas: number; unosi: boolean; pokazWynik: boolean },
): void {
  ctx.fillStyle = p.noc;
  ctx.fillRect(0, 0, SWIAT.szer, SWIAT.wys);

  for (const k of s.kolumny) {
    const gora = k.srodek - SZCZELINA / 2;
    const dol = k.srodek + SZCZELINA / 2;
    ctx.fillStyle = p.dym;
    ctx.fillRect(k.x, 0, SZER_KOLUMNY, gora);
    ctx.fillRect(k.x, dol, SZER_KOLUMNY, SWIAT.wys - dol);
    // Kapitele — szerszy blok na końcu każdej kolumny, od strony szczeliny.
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
  // Czarny kruk na prawie czarnym tle — widać go dzięki obrysowi w kolorze kości.
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

  if (o.pokazWynik) {
    ctx.fillStyle = p.kosc;
    ctx.font = `bold 44px ${p.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(s.wynik), SWIAT.szer / 2, 24);
  }
}
