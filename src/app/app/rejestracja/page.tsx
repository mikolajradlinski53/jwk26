import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
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
  if (!user) redirect("/wejscie");

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
      <Ekran tytul="Próba" podtytul="Czekaj na wyrok Kapłana">
        <p className="szklo rounded-md px-4 py-6 text-center text-sm leading-relaxed text-dym">
          Twoja ofiara została złożona.
        </p>
        <Wyloguj />
      </Ekran>
    );
  }

  return (
    <Ekran tytul={ostatnie ? "Ponowna próba" : "Próba"}>
      {ostatnie?.status === "rejected" && (
        <div className="szklo mb-5 rounded-md border-krew/50 px-4 py-3.5">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-krew-jasna">
            Odrzucono
          </p>
          <p className="mt-1 text-sm text-dym">
            {ostatnie.review_note ?? "Bez podania powodu."}
          </p>
        </div>
      )}

      <FormularzRejestracji />
      <Wyloguj />
    </Ekran>
  );
}

function Wyloguj() {
  return (
    <form action="/auth/signout" method="post" className="mt-10">
      <Button variant="cichy" type="submit" className="w-full">
        Wyloguj
      </Button>
    </form>
  );
}
