// Service worker JWK26 — wyłącznie powiadomienia push. Bez cache i trybu
// offline: apka działa na żywych danych, a przestarzała kopia z cache
// pokazywałaby nieaktualny ranking jako aktualny.

// Nowa wersja przejmuje od razu (2026-10-24): bez tego czekała, aż zamkną się
// wszystkie okna apki - a zainstalowana apka wisi w tle, więc kliknięcia
// w push obsługiwał stary worker. Nie ma tu cache, więc podmiana jest bezpieczna.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dane = {};
  try {
    dane = event.data ? event.data.json() : {};
  } catch {
    dane = { tresc: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(dane.tytul || "JWK26", {
      body: dane.tresc || "",
      icon: "/icon.png",
      badge: "/icon.png",
      lang: "pl",
      // Własny znacznik na każde powiadomienie + `renotify`: każde nowe
      // ogłoszenie wibruje i wyskakuje osobno, zamiast cicho podmieniać
      // poprzednie w szufladzie powiadomień.
      tag: dane.id ? "jwk26-" + dane.id : undefined,
      renotify: Boolean(dane.id),
      // Wibracja i dźwięk: Android obudzi ekran i pokaże baner u góry, jeśli
      // użytkownik nie wyciszył tej strony. iOS ignoruje `vibrate` — tam
      // o banerze i dźwięku decydują wyłącznie Ustawienia → Powiadomienia.
      vibrate: [200, 100, 200, 100, 200],
      silent: false,
      timestamp: Date.now(),
      data: { link: dane.link || "/app", id: dane.id || null },
    }),
  );
});

// Kliknięcie otwiera ekran powiadomienia w apce (2026-10-24: pełna treść
// i przycisk do miejsca, którego dotyczy), a stare powiadomienia bez id -
// wskazaną ścieżkę. Jeśli apka jest już otwarta, przełączamy istniejące okno
// zamiast otwierać drugie — na iPhonie drugie okno zainstalowanej apki
// wygląda jak zawieszenie.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const dane = event.notification.data || {};
  const link = new URL(dane.id ? "/app/powiadomienie/" + dane.id : dane.link || "/app", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((okna) => {
      for (const okno of okna) {
        if (okno.url.startsWith(self.location.origin) && "focus" in okno) {
          return okno.focus().then((o) => (o && "navigate" in o ? o.navigate(link) : o));
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
