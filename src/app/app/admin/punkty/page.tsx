import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { FormularzPunktow } from "./FormularzPunktow";
import type { Team, UserScore } from "@/types/db";
import { Wroc } from "@/components/Wroc";

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
      <Wroc href="/app/admin">Wróć do sanktuarium</Wroc>
    </Ekran>
  );
}
