"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Przyznanie punktów teamowi. Nie potrzebujemy service_role:
// RLS "ledger admin write" przepuści insert, bo robi go zalogowany admin.
// Jeśli robi to nie-admin, RLS odrzuci — zwracamy błąd.
export async function awardPoints(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano" };

  const team_id = String(formData.get("team_id"));
  const delta = parseInt(String(formData.get("delta")), 10);
  const reason = String(formData.get("reason") ?? "");

  if (!team_id || Number.isNaN(delta)) return { error: "Złe dane" };

  const { error } = await supabase.from("points_ledger").insert({
    team_id,
    delta,
    category: "admin_adjust",
    reason,
    awarded_by: user.id,
  });

  if (error) return { error: error.message }; // np. odbicie od RLS gdy nie-admin
  revalidatePath("/");
  return { ok: true };
}
