import { redirect } from "next/navigation";
import { LicznikKolejki } from "@/components/KolejkiAdmina";
import { NaglowekSekcji } from "@/components/NaglowekSekcji";
import { PozycjaMenu } from "@/components/PozycjaMenu";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { Button } from "@/components/ui/Button";
import { Powiadomienia } from "@/components/Powiadomienia";
import type { UserScore } from "@/types/db";

export default async function WiecejPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data: profil }, { data: wynik }] = await Promise.all([
    supabase.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("user_scores").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const mojWynik = wynik as UserScore | null;
  const jestAdminem = profil?.role === "admin";

  return (
    <Ekran tytul="Więcej" podtytul={profil?.display_name ?? undefined}>
      <div className="szklo mb-4 flex items-baseline justify-between rounded-md px-4 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-dym">
          {mojWynik?.team_name ?? "Bez drużyny"}
        </span>
        <strong className="font-tytul text-2xl leading-none tabular-nums">
          {mojWynik?.score ?? 0}
        </strong>
      </div>

      {/* Sekcje zamiast worka na wszystko (spec porządku, „Więcej”). Nagłówki
          „Powiadomienia” ma własny nagłówek - nie dublujemy go „Ustawieniami”. */}
      {jestAdminem && (
        <>
          <NaglowekSekcji>Organizator</NaglowekSekcji>
          <PozycjaMenu
            href="/app/admin"
            ikona="oko"
            nazwa="Sanktuarium"
            opis="Panel Organizatora"
            licznik={<LicznikKolejki ktora="suma" />}
          />
        </>
      )}

      <NaglowekSekcji>Zabawa</NaglowekSekcji>
      <nav className="grid gap-2.5">
        <PozycjaMenu href="/app/bingo?widok=gra" ikona="oko" nazwa="Gra terenowa" opis="Mapa zadań dla drużyn" />
        <PozycjaMenu href="/app/zawody" ikona="kielich" nazwa="Zawody" opis="Toplakyyy, siatkówka, poker, szachy" />
        <PozycjaMenu href="/app/arcade" ikona="karty" nazwa="Kasyno" opis="Sloty, blackjack i kruk" />
        <PozycjaMenu href="/app/gossip" ikona="gwiazda" nazwa="JWK Awards" opis="Anonimowe nominacje" />
      </nav>

      <Powiadomienia />

      <NaglowekSekcji>Informacje</NaglowekSekcji>
      <nav className="grid gap-2.5">
        <PozycjaMenu href="/regulamin" ikona="zwoj" nazwa="Regulamin" opis="Zasady wyjazdu" />
        <PozycjaMenu href="/prywatnosc" ikona="tarcza" nazwa="Prywatność" opis="Jak przetwarzamy Twoje dane" />
        <PozycjaMenu href="/app/harmonogram" ikona="zegar" nazwa="Harmonogram" opis="Co, kiedy i gdzie" />
      </nav>

      <form action="/auth/signout" method="post" className="mt-8">
        <Button variant="cichy" type="submit">
          Opuść sektę
        </Button>
      </form>
    </Ekran>
  );
}
