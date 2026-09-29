import { Ikona, type NazwaIkony } from "./Ikona";

/**
 * Pusty stan: szklana karta z tekstem, u uczestnika z ikoną nad nim.
 * Admin używa go bez ikony - tam liczy się zwięzłość.
 */
export function Pusto({ ikona, children }: { ikona?: NazwaIkony; children: React.ReactNode }) {
  return (
    <div className="szklo grid justify-items-center gap-3 rounded-md px-5 py-7 text-center text-sm text-dym">
      {ikona && <Ikona nazwa={ikona} className="size-20 text-dym" />}
      <p>{children}</p>
    </div>
  );
}
