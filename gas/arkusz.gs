/**
 * JWK26 — arkusz zapisów dla zespołu.
 *
 * Co 5 minut pobiera z bazy pełny stan zapisów (funkcja eksport_arkusza)
 * i NADPISUJE trzy zakładki: „Podsumowanie", „Zapisy", „Dane wrażliwe".
 * Pełne nadpisanie jest celowe: zgubiony przebieg naprawia następny, a gdy
 * baza skasuje dane po wyjeździe (retencja), znikają też stąd.
 *
 * Ręczne zmiany w tych trzech zakładkach przepadną przy następnym przebiegu.
 * Notatki zespołu trzymajcie w osobnej zakładce — skrypt jej nie dotyka.
 *
 * Konfiguracja: Ustawienia projektu → Właściwości skryptu
 *   SUPABASE_URL       https://<projekt>.supabase.co
 *   SUPABASE_ANON_KEY  klucz anon (publiczny, ten sam co w apce)
 *   SEKRET_ARKUSZA     wartość z tabeli `sekrety` (klucz 'arkusz')
 *
 * Instalacja: uruchom raz funkcję `zainstaluj` i zatwierdź uprawnienia.
 */

var ZAKLADKI = [
  { klucz: "podsumowanie", nazwa: "Podsumowanie" },
  { klucz: "zapisy", nazwa: "Zapisy" },
  { klucz: "wrazliwe", nazwa: "Dane wrażliwe" },
];

/** Jednorazowo: wyzwalacz co 5 minut i pierwsze odświeżenie. */
function zainstaluj() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "odswiez") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("odswiez").timeBased().everyMinutes(5).create();
  odswiez();
}

function odswiez() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty("SUPABASE_URL");
  var anon = p.getProperty("SUPABASE_ANON_KEY");
  var sekret = p.getProperty("SEKRET_ARKUSZA");
  if (!url || !anon || !sekret) {
    throw new Error("Brak właściwości skryptu: SUPABASE_URL, SUPABASE_ANON_KEY, SEKRET_ARKUSZA");
  }

  var odp = UrlFetchApp.fetch(url + "/rest/v1/rpc/eksport_arkusza", {
    method: "post",
    contentType: "application/json",
    headers: { apikey: anon, Authorization: "Bearer " + anon },
    payload: JSON.stringify({ p_sekret: sekret }),
    muteHttpExceptions: true,
  });

  // Przy błędzie arkusz zostaje w poprzednim stanie — lepiej nieaktualny
  // o 5 minut niż pusty. Treści odpowiedzi nie logujemy w całości.
  if (odp.getResponseCode() !== 200) {
    throw new Error("Eksport nie przeszedł: HTTP " + odp.getResponseCode());
  }

  var dane = JSON.parse(odp.getContentText());
  var plik = SpreadsheetApp.getActiveSpreadsheet();

  ZAKLADKI.forEach(function (z) {
    zapisz(plik, z.nazwa, dane[z.klucz]);
  });

  var podsumowanie = plik.getSheetByName("Podsumowanie");
  podsumowanie.getRange(1, 7).setValue("Ostatnia aktualizacja");
  podsumowanie.getRange(2, 7).setValue(dane.wygenerowano);
}

function zapisz(plik, nazwa, tabela) {
  var arkusz = plik.getSheetByName(nazwa) || plik.insertSheet(nazwa);
  arkusz.clearContents();

  var wiersze = [tabela.naglowki].concat(
    tabela.wiersze.map(function (w) {
      return w.map(komorka);
    }),
  );
  arkusz.getRange(1, 1, wiersze.length, tabela.naglowki.length).setValues(wiersze);
  arkusz.setFrozenRows(1);
  arkusz.getRange(1, 1, 1, tabela.naglowki.length).setFontWeight("bold");
}

/**
 * Wartość do komórki. Sheets wykonuje tekst zaczynający się od `=`, `+`, `-`
 * albo `@` jako formułę — a treść wpisują uczestnicy („=HYPERLINK(…)" w
 * uwagach) i `+48 600…` w telefonie zamieniłoby się w błąd. Apostrof każe
 * Sheets traktować to jako tekst i nie jest widoczny w komórce.
 */
function komorka(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  var s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
