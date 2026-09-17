/**
 * Rozpoznanie systemu i przeglądarki z ciągu identyfikacyjnego.
 *
 * Funkcje przyjmują ciąg zamiast czytać `navigator`, bo rozpoznanie dzieje się
 * **na serwerze**, z nagłówka żądania. Wersja czytająca `navigator` działała
 * dopiero po hydracji i zostawiała pustą ramkę w pierwszej klatce — akurat na
 * najczęstszej drodze wejścia, czyli u kogoś, kto kliknął link z Instagrama
 * na telefonie przy słabym łączu.
 *
 * Wyłącznie do doboru instrukcji — nie do decydowania o dostępie. Ciąg
 * identyfikacyjny da się podrobić, więc żadne zabezpieczenie nie może się
 * na nim opierać.
 */
export type System = "ios" | "android" | "inny";

export function system(ua: string): System {
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  // iPadOS 13+ podaje się za komputer i z samego nagłówka nie da się go
  // odróżnić od Maca — po stronie klienta zdradzał go `maxTouchPoints`, tu
  // nie mamy takiego sygnału. Taki iPad dostanie instrukcję ogólną, która
  // i tak prowadzi do celu; cena za poprawną pierwszą klatkę dla wszystkich.
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
export function wbudowanaPrzegladarka(ua: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Twitter|TikTok/i.test(ua);
}
