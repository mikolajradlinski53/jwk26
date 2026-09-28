// Service worker JWK26 — wyłącznie powiadomienia push. Bez cache i trybu
// offline: apka działa na żywych danych, a przestarzała kopia z cache
// pokazywałaby nieaktualny ranking jako aktualny.

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
      icon: "/icon",
      badge: "/icon",
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
      data: { link: dane.link || "/app" },
    }),
  );
});

// Kliknięcie otwiera wskazaną ścieżkę apki. Jeśli apka jest już otwarta,
// przełączamy istniejące okno zamiast otwierać drugie — na iPhonie drugie
// okno zainstalowanej apki wygląda jak zawieszenie.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = new URL(
    (event.notification.data && event.notification.data.link) || "/app",
    self.location.origin,
  ).href;

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
