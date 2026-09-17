import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { FormularzPunktow } from "./FormularzPunktow";
import type { Team, UserScore } from "@/types/db";

export default async function PunktyPage() {
  const supabase = await createClient();

  const [{ data: druzyny }, { data: osoby }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("user_scores").select("*").order("display_name"),
  ]);

  return (
    <Ekran tytul="Punkty" podtytul="Przyznane ręcznie trafiają do tej samej księgi">
      <FormularzPunktow
        druzyny={(druzyny ?? []) as Team[]}
        osoby={(osoby ?? []) as UserScore[]}
      />
      <Link
        href="/app/admin"
        className="mt-7 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
      >
        Wróć do sanktuarium
      </Link>
    </Ekran>
  );
}
