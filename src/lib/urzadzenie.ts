/**
 * Rozpoznanie systemu i przeglądarki po stronie klienta.
 *
 * Wyłącznie do doboru instrukcji — nie do decydowania o dostępie. Ciąg
 * identyfikacyjny przeglądarki da się podrobić, więc żadne zabezpieczenie
 * nie może się na nim opierać.
 */
export type System = "ios" | "android" | "inny";

export function system(): System {
  if (typeof navigator === "undefined") return "inny";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ podaje się za komputer — rozpoznajemy go po dotyku.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  return "inny";
}

/**
 * Czy stronę otwarto w przeglądarce wbudowanej w aplikację społecznościową.
 *
 * Takie przeglądarki nie potrafią instalować aplikacji na ekranie głównym,
 * a skoro promocja idzie przez Instagram, to najczęstsza droga wejścia.
 * Bez tego sprawdzenia tutorial tłumaczyłby gest, którego nie da się wykonać,
 * i wyglądałby dla człowieka jak zepsuta strona.
 */
export function wbudowanaPrzegladarka(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Twitter|TikTok/i.test(
    navigator.userAgent,
  );
}
