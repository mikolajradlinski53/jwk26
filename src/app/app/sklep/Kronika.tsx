import type { WpisKroniki } from "@/types/db";

const OPIS_STANU: Record<WpisKroniki["status"], string> = {
  pending: "czeka na wydanie",
  fulfilled: "wydane",
  cancelled: "anulowane",
};

export function Kronika({ wpisy }: { wpisy: WpisKroniki[] }) {
  if (wpisy.length === 0) {
    return (
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
        Nikt jeszcze niczego nie kupił.
      </p>
    );
  }

  return (
    <ol className="grid gap-2">
      {wpisy.map((w) => (
        <li key={w.id} className="szklo rounded-md px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-sm font-bold">{w.item_name}</span>
            <span className="flex-none font-tytul text-sm tabular-nums text-dym">
              −{w.price_paid}
            </span>
          </div>
          <p className="mt-1 text-xs text-dym">
            <span style={{ color: w.team_color }}>{w.team_name}</span>
            {w.target_team_name && <> → {w.target_team_name}</>}
            {" · "}
            {w.note ?? OPIS_STANU[w.status]}
          </p>
        </li>
      ))}
    </ol>
  );
}
