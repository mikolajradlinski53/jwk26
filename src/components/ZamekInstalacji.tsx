import { headers } from "next/headers";
import { Ekran } from "@/components/Ekran";
import { PrzyciskKopiuj } from "@/components/PrzyciskKopiuj";
import { system, wbudowanaPrzegladarka, type System } from "@/lib/urzadzenie";

const KROKI: Record<System, string[]> = {
  ios: [
    "Naciśnij przycisk Udostępnij na dolnym pasku Safari.",
    "Przewiń listę i wybierz „Do ekranu początkowego”.",
    "Naciśnij Dodaj w prawym górnym rogu.",
  ],
  android: [
    "Naciśnij menu trzech kropek w prawym górnym rogu.",
    "Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.",
    "Potwierdź.",
  ],
  inny: [
    "Otwórz tę stronę na telefonie.",
    "Dodaj ją do ekranu głównego z menu przeglądarki.",
  ],
};

function Tutorial({ sys, wAplikacji, adres }: { sys: System; wAplikacji: boolean; adres: string }) {
  if (wAplikacji) {
    return (
      <div className="szklo grid gap-4 rounded-lg p-5">
        <p className="text-sm text-kosc">
          Otworzyłeś to w przeglądarce Instagrama, a ona nie potrafi dodawać
          aplikacji do ekranu głównego. Otwórz ten adres w Safari albo Chrome.
        </p>
        <PrzyciskKopiuj adres={adres} />
      </div>
    );
  }

  return (
    <div className="szklo grid gap-4 rounded-lg p-5">
      <p className="text-sm text-kosc">
        Sekta mieszka na ekranie głównym, nie w przeglądarce. Przypnij ją,
        a potem otwórz stąd — inaczej nie dostaniesz powiadomień.
      </p>
      <ol className="grid list-decimal gap-2 pl-5 text-sm text-dym">
        {KROKI[sys].map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Wpuszcza dalej tylko w trybie aplikacji; w zwykłej karcie pokazuje tutorial.
 *
 * O widoczności rozstrzyga CSS (`display-mode`), nie JavaScript — reguła
 * obowiązuje od pierwszej klatki, więc nie ma błysku niewłaściwej treści przed
 * hydracją. Same instrukcje składa serwer z nagłówka żądania, żeby pierwsza
 * klatka była nie tylko właściwa, ale i niepusta.
 *
 * To bramka wygody, nie bezpieczeństwa: treść jest w drzewie, tylko ukryta.
 * Prawdziwą granicą pozostaje bramka sesji w `proxy.ts`.
 *
 * Musi obejmować **całą** apkę, nie sam ekran wejścia. Przegląd wykazał, że
 * nałożony wyłącznie na `/wejscie` niczego nie zamyka: zalogowany otwierał
 * `/app/feed` w zwykłej karcie Safari i dostawał pełną treść.
 */
export async function ZamekInstalacji({ children }: { children: React.ReactNode }) {
  const naglowki = await headers();
  const ua = naglowki.get("user-agent") ?? "";
  const gospodarz = naglowki.get("host") ?? "";
  const protokol = naglowki.get("x-forwarded-proto") ?? "https";

  return (
    <>
      <div className="tylko-w-przegladarce">
        <Ekran tytul="Wstąp do Sekty" podtytul="Najpierw przypnij">
          <Tutorial
            sys={system(ua)}
            wAplikacji={wbudowanaPrzegladarka(ua)}
            adres={`${protokol}://${gospodarz}`}
          />
        </Ekran>
      </div>
      <div className="tylko-w-apce">{children}</div>
    </>
  );
}
