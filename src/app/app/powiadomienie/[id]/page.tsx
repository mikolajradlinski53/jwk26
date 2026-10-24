import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Wroc } from "@/components/Wroc";

const KIEDY = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** Dokąd prowadzi powiadomienie - nazwa przycisku po ścieżce. */
function nazwaCelu(link: string): string {
  if (link.startsWith("/app/feed")) return "Zobacz feed";
  if (link.startsWith("/app/bingo")) return "Przejdź do bingo";
  if (link.startsWith("/app/sklep")) return "Przejdź do licytacji";
  if (link.startsWith("/app/gra")) return "Przejdź do gry terenowej";
  if (link.startsWith("/app/harmonogram")) return "Zobacz harmonogram";
  return "Przejdź do apki";
}

type Powiadomienie = { id: number; tytul: string; body: string | null; link: string; created_at: string };

/**
 * Ekran jednego powiadomienia (feedback uczestników 2026-10-24): kliknięcie
 * w push otwiera tę stronę z pełną treścią - baner w telefonie ucina dłuższe
 * ogłoszenia. Treść czyta tylko adresat (moje_powiadomienie w bazie).
 */
export default async function PowiadomieniePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numer = Number.parseInt(id, 10);
  const supabase = await createClient();
  const { data } = Number.isFinite(numer)
    ? await supabase.rpc("moje_powiadomienie", { p_id: numer })
    : { data: null };
  const p = ((data ?? []) as Powiadomienie[])[0];

  if (!p) {
    return (
      <Ekran tytul="Powiadomienie">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Tego powiadomienia nie ma albo nie było do Ciebie.
        </p>
        <Wroc href="/app">Do apki</Wroc>
      </Ekran>
    );
  }

  return (
    <Ekran tytul="Powiadomienie" podtytul={KIEDY.format(new Date(p.created_at))}>
      <article className="szklo rounded-lg px-5 py-6">
        <h2 className="font-tytul text-2xl leading-tight text-kosc">{p.tytul}</h2>
        {p.body && <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-kosc/90">{p.body}</p>}
      </article>
      <Link
        href={p.link}
        className="szklo-plynne szklo-plynne-krew mt-5 flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew"
      >
        {nazwaCelu(p.link)}
      </Link>
      <Wroc href="/app">Do rankingu</Wroc>
    </Ekran>
  );
}
