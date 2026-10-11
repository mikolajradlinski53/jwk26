import { describe, it, expect } from "vitest";
import { stanZadania } from "../src/app/app/gra/Zadania";
import type { BingoSubmission } from "../src/types/db";

const z = (status: string, created_at: string, review_note: string | null = null) =>
  ({ id: created_at, status, created_at, review_note, user_id: "u", team_id: "t", task_id: "q" }) as unknown as BingoSubmission;

describe("stanZadania", () => {
  it("bez zgłoszeń - do zrobienia", () => {
    expect(stanZadania([]).stan).toBe("do-zrobienia");
  });

  it("żywe zgłoszenie wygrywa z wcześniejszym odrzuceniem", () => {
    expect(stanZadania([z("rejected", "1"), z("pending", "2")]).stan).toBe("czeka");
    expect(stanZadania([z("rejected", "1"), z("approved", "2")]).stan).toBe("zaliczone");
  });

  it("po odrzuceniu pokazuje powód ostatniego odrzucenia", () => {
    const w = stanZadania([z("rejected", "2026-10-23T10:00", "stare"), z("rejected", "2026-10-23T12:00", "nowe")]);
    expect(w.stan).toBe("odrzucone");
    expect(w.odrzucone?.review_note).toBe("nowe");
  });
});
