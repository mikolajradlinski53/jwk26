"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export type KomentarzWpis = {
  id: string;
  userId: string;
  tresc: string;
  createdAt: string;
  autor: string;
};

type BladPostgrest = { message?: string; code?: string } | Error | unknown;

/**
 * Tłumaczy błąd techniczny na zdanie po polsku, z którym uczestnik ma co
 * zrobić — ten sam pomysł co w `Plansza.tsx`.
 */
function komunikat(e: BladPostgrest): string {
  const tekst = e instanceof Error ? e.message : String(e);

  if (/row-level security|jwt|expired|401/i.test(tekst)) {
    return "Sesja wygasła. Zaloguj się ponownie.";
  }
  if (/check constraint|feed_comments_body_check|between 1 and 500/i.test(tekst)) {
    return "Komentarz musi mieć od 1 do 500 znaków.";
  }
  if (/failed to fetch|networkerror|network/i.test(tekst)) {
    return "Zerwało połączenie. Sprawdź zasięg i spróbuj jeszcze raz.";
  }
  return "Coś poszło nie tak. Spróbuj jeszcze raz.";
}

function Serce({ wypelnione }: { wypelnione: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={wypelnione ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5 shrink-0"
    >
      <path d="M12 20.2s-7.6-4.6-10-9.1C.5 7.9 2.3 4.8 5.6 4.3c2-.3 3.9.6 5 2.3 1-1.7 3-2.6 5-2.3 3.3.5 5.1 3.6 3.6 6.8-2.4 4.5-9.2 9.1-9.2 9.1z" />
    </svg>
  );
}

function Kosz() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

function Wyslij() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path d="M4 12h15m0 0-6-6m6 6-6 6" />
    </svg>
  );
}

export function Wpis({
  id,
  zdjecieUrl,
  podpis,
  utworzonoIso,
  utworzonoTekst,
  zadanieTytul,
  punkty,
  druzynaNazwa,
  druzynaKolor,
  autor,
  userId,
  mojeImie,
  isAdmin,
  initialLikes,
  initialComments,
}: {
  id: string;
  zdjecieUrl: string | null;
  podpis: string | null;
  utworzonoIso: string;
  utworzonoTekst: string;
  zadanieTytul: string;
  punkty: number;
  druzynaNazwa: string;
  druzynaKolor: string;
  autor: string;
  userId: string;
  mojeImie: string;
  isAdmin: boolean;
  initialLikes: string[];
  initialComments: KomentarzWpis[];
}) {
  const [lajki, setLajki] = useState(initialLikes);
  const [bladLajku, setBladLajku] = useState<string | null>(null);

  const [komentarze, setKomentarze] = useState(initialComments);
  const [tresc, setTresc] = useState("");
  const [wysylanie, setWysylanie] = useState(false);
  const [bladKomentarza, setBladKomentarza] = useState<string | null>(null);
  const [kasowanyId, setKasowanyId] = useState<string | null>(null);

  const polubione = lajki.includes(userId);
  const liczbaLubien = lajki.length;

  // Czego użytkownik chce, i co już leży w bazie. Dwie osobne prawdy, bo
  // między stuknięciem a odpowiedzią serwera rozjeżdżają się na chwilę.
  const pragnienie = useRef(initialLikes.includes(userId));
  const zapisane = useRef(initialLikes.includes(userId));
  const synchronizacjaTrwa = useRef(false);

  /**
   * Doprowadza bazę do stanu, którego użytkownik chce — po jednym żądaniu
   * naraz, aż jedno i drugie się zgodzi.
   *
   * Naiwne „wystrzel żądanie przy każdym stuknięciu" rozjeżdżało licznik
   * z bazą w 53% prób na żywej bazie (zmierzone, nie oszacowane). Winne nie
   * były refleksy klikającego, tylko to, że INSERT przechodzi politykę RLS
   * z podzapytaniem na profiles i dwa sprawdzenia kluczy obcych, a DELETE
   * idzie prosto po kluczu głównym. INSERT jest systematycznie wolniejszy,
   * więc wysłany pierwszy potrafi skończyć się drugi — i lajk zostawał
   * w bazie mimo odklikania, aż do odświeżenia strony.
   *
   * Blokada przycisku na czas żądania też by to zamknęła, ale gubiłaby
   * drugie stuknięcie. Tutaj każde stuknięcie liczy się od razu w interfejsie,
   * a pętla dosyła tyle żądań, ile trzeba, żeby baza dogoniła ostatnią wolę.
   */
  async function zsynchronizujLubienie() {
    if (synchronizacjaTrwa.current) return;
    synchronizacjaTrwa.current = true;

    try {
      const supabase = createClient();

      while (pragnienie.current !== zapisane.current) {
        const cel = pragnienie.current;

        const { error } = cel
          ? await supabase.from("feed_likes").insert({ submission_id: id, user_id: userId })
          : await supabase
              .from("feed_likes")
              .delete()
              .eq("submission_id", id)
              .eq("user_id", userId);

        const kod = (error as { code?: string } | null)?.code;

        // 23505 na kluczu (submission_id, user_id) może znaczyć tylko jedno:
        // wiersz tej osoby już tam jest. Czyli cel osiągnięty, nie usterka.
        if (!error || (cel && kod === "23505")) {
          zapisane.current = cel;
          continue;
        }

        console.error("Lajk nie przeszedł:", error);
        // Baza została przy swoim, więc interfejs musi się do niej cofnąć —
        // inaczej pokazywałby obietnicę, której nikt nie dotrzymał.
        pragnienie.current = zapisane.current;
        setLajki((poprzednie) =>
          zapisane.current
            ? poprzednie.includes(userId)
              ? poprzednie
              : [...poprzednie, userId]
            : poprzednie.filter((uid) => uid !== userId),
        );
        setBladLajku("Lajk się nie zapisał. Spróbuj jeszcze raz.");
        return;
      }
    } finally {
      synchronizacjaTrwa.current = false;
    }
  }

  function przelaczLubienie() {
    const wlacz = !pragnienie.current;
    pragnienie.current = wlacz;
    setBladLajku(null);

    setLajki((poprzednie) =>
      wlacz
        ? poprzednie.includes(userId)
          ? poprzednie
          : [...poprzednie, userId]
        : poprzednie.filter((uid) => uid !== userId),
    );

    void zsynchronizujLubienie();
  }

  async function wyslijKomentarz(e: FormEvent) {
    e.preventDefault();
    if (wysylanie) return;

    const przyciety = tresc.trim();
    // Egzekwujemy limit również po stronie klienta, ale to nie zastępuje
    // obsługi błędu z bazy niżej — bez tego komentarz i tak by odbił.
    if (przyciety.length < 1 || przyciety.length > 500) {
      setBladKomentarza("Komentarz musi mieć od 1 do 500 znaków.");
      return;
    }

    setWysylanie(true);
    setBladKomentarza(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("feed_comments")
      .insert({ submission_id: id, user_id: userId, body: przyciety })
      .select("id, created_at")
      .single();

    setWysylanie(false);

    if (error) {
      console.error("Komentarz nie przeszedł:", error);
      setBladKomentarza(komunikat(error));
      return;
    }

    setKomentarze((poprzednie) => [
      ...poprzednie,
      { id: data.id, userId, tresc: przyciety, createdAt: data.created_at, autor: mojeImie },
    ]);
    setTresc("");
  }

  async function usunKomentarz(komentarzId: string) {
    if (kasowanyId) return;
    setKasowanyId(komentarzId);
    setBladKomentarza(null);

    const supabase = createClient();
    const { error } = await supabase.from("feed_comments").delete().eq("id", komentarzId);

    setKasowanyId(null);

    if (error) {
      console.error("Kasowanie komentarza nie przeszło:", error);
      setBladKomentarza(komunikat(error));
      return;
    }

    setKomentarze((poprzednie) => poprzednie.filter((k) => k.id !== komentarzId));
  }

  return (
    <article className="szklo overflow-hidden rounded-lg">
      {zdjecieUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={zdjecieUrl}
          alt={`Zdjęcie do zadania „${zadanieTytul}", wrzucone przez ${autor}`}
          loading="lazy"
          className="aspect-square w-full object-cover"
        />
      ) : (
        <p className="flex aspect-square w-full items-center justify-center bg-noc-glab text-center text-sm text-krew-jasna">
          Nie udało się wczytać zdjęcia.
        </p>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-kosc">{autor}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-dym">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: druzynaKolor }}
              />
              {druzynaNazwa}
            </p>
          </div>
          <time
            dateTime={utworzonoIso}
            className="flex-none text-[0.62rem] tabular-nums text-dym"
          >
            {utworzonoTekst}
          </time>
        </div>

        <p className="mt-3 font-tytul text-base text-kosc">{zadanieTytul}</p>
        <p className="text-xs uppercase tracking-widest text-dym">{punkty} pkt</p>

        {podpis && <p className="mt-2 text-sm leading-relaxed text-kosc">{podpis}</p>}

        <div className="mt-3.5 flex items-center gap-2 border-t border-white/10 pt-3.5">
          <button
            type="button"
            onClick={() => void przelaczLubienie()}
            aria-pressed={polubione}
            aria-label={polubione ? "Cofnij lajka" : "Polub"}
            className={
              "flex min-h-11 min-w-11 items-center gap-1.5 rounded-full px-3 " +
              "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew " +
              (polubione ? "text-krew-jasna" : "text-dym hover:text-kosc")
            }
          >
            <Serce wypelnione={polubione} />
            <span className="text-sm font-bold tabular-nums">{liczbaLubien}</span>
          </button>
        </div>
        {bladLajku && <p className="mt-1 text-xs text-krew-jasna">{bladLajku}</p>}

        {komentarze.length > 0 && (
          <ul className="mt-3 grid gap-1.5 border-t border-white/10 pt-3.5">
            {komentarze.map((k) => (
              <li key={k.id} className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-kosc">
                  <b className="font-bold">{k.autor}</b>{" "}
                  <span className="break-words">{k.tresc}</span>
                </p>
                {(k.userId === userId || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => void usunKomentarz(k.id)}
                    disabled={kasowanyId === k.id}
                    aria-label="Usuń komentarz"
                    className="grid size-11 shrink-0 place-items-center rounded-full text-dym
                               hover:text-krew-jasna focus-visible:outline-2 focus-visible:outline-offset-2
                               focus-visible:outline-krew disabled:opacity-40"
                  >
                    <Kosz />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={wyslijKomentarz} className="mt-3 flex items-center gap-2">
          <label className="sr-only" htmlFor={`komentarz-${id}`}>
            Dodaj komentarz
          </label>
          <input
            id={`komentarz-${id}`}
            value={tresc}
            onChange={(e) => setTresc(e.target.value.slice(0, 500))}
            placeholder="Dodaj komentarz..."
            maxLength={500}
            className="szklo min-h-11 w-full flex-1 rounded-full px-4 text-sm text-kosc outline-none
                       placeholder:text-dym focus-visible:border-krew"
          />
          <button
            type="submit"
            disabled={wysylanie || tresc.trim().length === 0}
            aria-label="Wyślij komentarz"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20
                       bg-gradient-to-b from-krew/90 to-krew-glab/90 text-white
                       shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew
                       disabled:from-dym/30 disabled:to-dym/30 disabled:shadow-none"
          >
            <Wyslij />
          </button>
        </form>
        {bladKomentarza && <p className="mt-1.5 text-xs text-krew-jasna">{bladKomentarza}</p>}
      </div>
    </article>
  );
}
