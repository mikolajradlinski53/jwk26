import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import { NAZWY_STATUSU, type KategoriaGossipow } from "@/lib/gossipy";
import { Glosowanie } from "./Glosowanie";

export default async function GossipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data, error }, { data: ustawienie }] = await Promise.all([
    supabase.rpc("gossipy"),
    supabase.from("app_settings").select("value").eq("key", "gossip_min_justification").maybeSingle(),
  ]);
  const kategorie = (data ?? []) as KategoriaGossipow[];
  const minimum = Number(ustawienie?.value ?? 200) || 200;

  return (
    <Ekran tytul="Gossipy" podtytul="Anonimowe głosowania">
      {error && (
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać gossipów. Odśwież stronę.
        </p>
      )}
      {!error && kategorie.length === 0 && (
        <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
          Jeszcze nic. Pierwsza kategoria pojawi się, gdy ogłosi ją organizator.
        </p>
      )}

      <ul className="grid gap-4">
        {kategorie.map((k) => (
          <li key={k.id} className="szklo grid gap-3 rounded-md px-4 py-4">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
                {NAZWY_STATUSU[k.status]}
              </p>
              <h2 className="mt-1 font-tytul text-xl leading-tight text-kosc">{k.tytul}</h2>
              {k.opis && <p className="mt-1 text-sm text-dym">{k.opis}</p>}
            </div>

            {k.status === "ujawniona" && k.zwyciezcy && (
              <div className="grid gap-3">
                <p className="text-sm text-dym">
                  {k.zwyciezcy.length > 1 ? "Ex aequo:" : "Wygrywa:"}{" "}
                  <strong className="text-lg text-krew-jasna">
                    {k.zwyciezcy.map((z) => z.nazwa).join(" i ")}
                  </strong>
                </p>
                {(k.uzasadnienia ?? []).length > 0 && (
                  <ul className="grid gap-2">
                    {k.uzasadnienia!.map((u, i) => (
                      <li
                        key={i}
                        className="rounded-sm border-l-2 border-krew/60 pl-3 text-sm leading-relaxed text-kosc"
                      >
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {k.status === "otwarta" && k.moj_glos && (
              <p className="text-sm text-dym">
                Twój głos jest oddany. Wynik zobaczysz, gdy organizator go ujawni.
              </p>
            )}
            {k.status === "otwarta" && !k.moj_glos && (
              <Glosowanie kategoria={k.id} nominowani={k.nominowani} ja={user.id} minimum={minimum} />
            )}
            {k.status === "zamknieta" && (
              <p className="text-sm text-dym">Wynik zobaczysz, gdy organizator go ujawni.</p>
            )}
          </li>
        ))}
      </ul>

      {/* Ujawnienie przychodzi pushem; po powrocie do apki strona ma już wynik. */}
      <div className="mt-6">
        <OdswiezPrzyPowrocie />
      </div>

      <Link
        href="/app/wiecej"
        className="mt-4 flex min-h-11 items-center justify-center text-center text-xs uppercase tracking-[0.14em] text-dym hover:text-kosc"
      >
        Wróć
      </Link>
    </Ekran>
  );
}
