import Link from "next/link";
import { RitualFrame } from "@/components/RitualFrame";

export default function AdminPage() {
  return (
    <RitualFrame title="Sanktuarium">
      <nav className="grid gap-3">
        <Link
          href="/admin/rejestracje"
          className="flex min-h-11 items-center border border-candle/40 px-4
                     font-display text-sm uppercase tracking-widest text-candle
                     hover:bg-candle/10"
        >
          Zgłoszenia
        </Link>
      </nav>
    </RitualFrame>
  );
}
