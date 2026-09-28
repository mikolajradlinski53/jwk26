/**
 * CSV do otwarcia w Excelu po polsku.
 *
 * - średnik zamiast przecinka: polski Excel traktuje przecinek jako separator
 *   dziesiętny i przy przecinkach wkleja wszystko do jednej kolumny;
 * - BOM na początku: bez niego Excel czyta UTF-8 jako Windows-1250 i psuje ogonki;
 * - CRLF między wierszami, jak chce RFC 4180;
 * - ochrona przed formułami: wartości od `=`, `+`, `-`, `@` dostają apostrof.
 *   Treść wpisują uczestnicy, a „=HYPERLINK(…)" w uwagach wykonałby się
 *   u organizatora jako formuła (CSV injection).
 */
export function doCsv(naglowki: string[], wiersze: (string | null)[][]): string {
  const linie = [naglowki, ...wiersze].map((w) => w.map(komorka).join(";"));
  return "﻿" + linie.join("\r\n") + "\r\n";
}

function komorka(wartosc: string | null): string {
  if (wartosc === null) return "";
  const bezpieczna = /^[=+\-@]/.test(wartosc) ? `'${wartosc}` : wartosc;
  return /[;"\r\n]/.test(bezpieczna) ? `"${bezpieczna.replace(/"/g, '""')}"` : bezpieczna;
}
