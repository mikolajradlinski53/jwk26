import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ekran } from "@/components/Ekran";
import { OdswiezPrzyPowrocie } from "@/components/OdswiezPrzyPowrocie";
import {
  NAZWY_STATUSU,
  adresZdjeciaGossipu,
  type Kandydat,
  type KategoriaGossipow,
} from "@/lib/gossipy";
import { Nominacja } from "./Nominacja";
import { Wroc } from "@/components/Wroc";
import { Pusto } from "@/components/Pusto";

export default async function GossipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/wejscie");

  const [{ data, error }, { data: kandydaciRaw }, { data: ustawienie }] = await Promise.all([
    supabase.rpc("gossipy"),
    supabase.rpc("kandydaci_gossipow"),
    supabase.from("app_settings").select("value").eq("key", "gossip_min_justification").maybeSingle(),
  ]);
  const kategorie = (data ?? []) as KategoriaGossipow[];
  const kandydaci = (kandydaciRaw ?? []) as Kandydat[];
  const minimum = Number(ustawienie?.value ?? 200) || 200;

  return (
    <Ekran tytul="JWK Awards" podtytul="Anonimowe nominacje">
      {error && (
        <p className="szklo rounded-md px-4 py-3.5 text-sm text-krew-jasna">
          Nie udało się wczytać kategorii JWK Awards. Odśwież stronę.
        </p>
      )}
      {!error && kategorie.length === 0 && (
        <Pusto ikona="list">Jeszcze nic. Pierwsza kategoria pojawi się, gdy ogłosi ją organizator.</Pusto>
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
                {k.zwyciezcy.length === 0 ? (
                  <p className="text-sm text-dym">Nikt nie został nominowany.</p>
                ) : (
                  <p className="text-sm text-dym">
                    {k.zwyciezcy.length > 1 ? "Ex aequo:" : "Wygrywa:"}{" "}
                    <strong className="text-lg text-krew-jasna">
                      {k.zwyciezcy.map((z) => z.nazwa).join(" i ")}
                    </strong>
                  </p>
                )}
                {(k.uzasadnienia ?? []).length > 0 && (
                  <ul className="grid gap-3">
                    {k.uzasadnienia!.map((u, i) => (
                      <li
                        key={i}
                        className="grid gap-2 rounded-sm border-l-2 border-krew/60 pl-3 text-sm leading-relaxed text-kosc"
                      >
                        <p>{u.tekst}</p>
                        {u.zdjecie && (
                          // eslint-disable-next-line @next/next/no-img-element -- prywatna trasa z sesją, bez optymalizatora
                          <img
                            src={adresZdjeciaGossipu(u.zdjecie)}
                            alt="Zdjęcie dołączone do nominacji"
                            loading="lazy"
                            className="max-h-80 w-full rounded-sm object-cover"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {k.status === "otwarta" && k.moj_glos && (
              <p className="text-sm text-dym">
                Nominujesz: <strong className="text-kosc">{k.moj_typ}</strong>. Wynik zobaczysz, gdy
                organizator go ujawni.
              </p>
            )}
            {k.status === "otwarta" && !k.moj_glos && (
              <Nominacja kategoria={k.id} kandydaci={kandydaci} minimum={minimum} />
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

      <Wroc href="/app/wiecej">Wróć</Wroc>
    </Ekran>
  );
}
