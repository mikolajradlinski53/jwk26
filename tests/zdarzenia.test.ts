import { describe, it, expect } from "vitest";
import { kodBledu } from "../src/lib/zdarzenia";

describe("kodBledu", () => {
  it("wyciąga sam kod, bez treści komunikatu", () => {
    expect(kodBledu("PULA_PELNA")).toBe("PULA_PELNA");
    expect(kodBledu("SKLAD_ZAJETY: Gracz 1, Gracz 4")).toBe("SKLAD_ZAJETY");
    expect(kodBledu("Failed to fetch")).toBe("SIEC");
    expect(kodBledu('duplicate key value violates unique constraint "registrations_one_pending_idx"')).toBe("DUBEL");
  });

  it("surowy komunikat bazy z danymi to „inny”", () => {
    expect(kodBledu('new row violates check constraint, Failing row contains (Jan, Kowalski, alergia na orzechy)')).toBe("inny");
  });
});
