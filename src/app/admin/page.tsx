import Link from "next/link";
import { Ekran } from "@/components/Ekran";

export default function AdminPage() {
  return (
    <Ekran tytul="Sanktuarium">
      <nav className="grid gap-3">
        <Link
          href="/admin/rejestracje"
          className="flex min-h-11 items-center border border-candle/40 px-4
                     font-display text-sm uppercase tracking-widest text-candle
                     hover:bg-candle/10"
        >
          Zgłoszenia
        </Link>

        <Link
          href="/"
          className="flex min-h-11 items-center px-4 font-display text-sm
                     uppercase tracking-widest text-smoke hover:text-candle"
        >
          ← Ranking
        </Link>
      </nav>
    </Ekran>
  );
}
