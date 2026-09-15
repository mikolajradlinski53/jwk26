import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RitualFrame } from "@/components/RitualFrame";
import { Button } from "@/components/ui/Button";
import { FormularzRejestracji } from "./FormularzRejestracji";
import type { Registration } from "@/types/db";

export default async function RejestracjaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bramka w proxy.ts nie wpuści tu niezalogowanego, ale token może wygasnąć
  // między jej sprawdzeniem a tym renderem. Lepsze przekierowanie niż 500.
  if (!user) redirect("/login");

  // RLS i tak przepuszcza wyłącznie własne zgłoszenia, ale filtr po user_id
  // zostawia zapytaniu indeks do wykorzystania.
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ostatnie = data as Registration | null;

  if (ostatnie?.status === "pending") {
    return (
      <RitualFrame title="Próba">
        <p className="text-center leading-relaxed text-smoke">
          Twoja ofiara została złożona. Czekaj na wyrok Kapłana.
        </p>
        <Wyloguj />
      </RitualFrame>
    );
  }

  return (
    <RitualFrame title={ostatnie ? "Ponowna próba" : "Próba"}>
      {ostatnie?.status === "rejected" && (
        <div className="mb-6 border-l-4 border-blood bg-ash/60 px-4 py-3">
          <p className="font-display text-xs uppercase tracking-widest text-blood">
            Odrzucono
          </p>
          <p className="mt-1 text-sm text-smoke">
            {ostatnie.review_note ?? "Bez podania powodu."}
          </p>
        </div>
      )}

      <FormularzRejestracji />
      <Wyloguj />
    </RitualFrame>
  );
}

function Wyloguj() {
  return (
    <form action="/auth/signout" method="post" className="mt-10">
      <Button variant="ghost" type="submit" className="w-full">
        Wyloguj
      </Button>
    </form>
  );
}
