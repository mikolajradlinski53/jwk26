import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { awardPoints } from "./actions";

// Panel admina. Guard po stronie serwera: kto nie jest adminem, leci na "/".
export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  const { data: teams } = await supabase.from("teams").select("id, name").order("name");

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <h1>⚙️ Panel Wielkiego Kapłana</h1>

      <form action={awardPoints} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <select name="team_id" required>
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input name="delta" type="number" placeholder="Ile punktów (np. 50 lub -30)" required />
        <input name="reason" placeholder="Za co (np. wygrane zadanie)" />
        <button type="submit">Przyznaj punkty</button>
      </form>
    </main>
  );
}
