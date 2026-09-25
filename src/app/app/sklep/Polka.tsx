"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { ShopItem, Team } from "@/types/db";

export function Polka({
  pozycje,
  saldo,
  jestKapitanem,
  nazwaKapitana,
  obceDruzyny,
}: {
  pozycje: ShopItem[];
  saldo: number;
  jestKapitanem: boolean;
  nazwaKapitana: string | null;
  obceDruzyny: Team[];
}) {
  const router = useRouter();
  const [otwarta, setOtwarta] = useState<string | null>(null);
  const [cel, setCel] = useState<string>("");
  const [blad, setBlad] = useState<string | null>(null);
  const [udane, setUdane] = useState<string | null>(null);
  const [czeka, setCzeka] = useState<string | null>(null);
  // Straż przed podwójnym kliknięciem idzie przez ref, nie przez sam stan:
  // setCzeka jest asynchroniczne i drugie kliknięcie w tej samej klatce
  // przeszłoby, zanim React zdąży przerysować przycisk.
  const wToku = useRef(false);

  async function kup(pozycja: ShopItem) {
    if (wToku.current) return;
    setBlad(null);
    setUdane(null);

    if (pozycja.requires_target && !cel) {
      setBlad("Wskaż drużynę");
      return;
    }

    wToku.current = true;
    setCzeka(pozycja.id);

    const { error } = await createClient().rpc("kup_z_polki", {
      p_item_id: pozycja.id,
      p_target_team: pozycja.requires_target ? cel : null,
    });

    // Odblokowanie idzie przed sprawdzeniem błędu, nie po. Wyjście z funkcji
    // przy zostawionym `wToku` zablokowałoby półkę do przeładowania strony —
    // a w trybie aplikacji na iOS przeładowania może nie być.
    setCzeka(null);
    wToku.current = false;

    if (error) {
      console.error("Zakup nie przeszedł:", error);
      setBlad(error.message);
      return;
    }

    setUdane(
      pozycja.kind === "physical"
        ? `${pozycja.name} — zamówione, czeka na wydanie`
        : `${pozycja.name} — zadziałało`,
    );
    setOtwarta(null);
    setCel("");
    router.refresh();
  }

  return (
    <div className="grid gap-2.5">
      {udane && (
        <p role="status" className="px-1 text-sm text-krew-jasna">
          {udane}
        </p>
      )}

      {pozycje.map((p) => {
        const nieStac = saldo < p.price;
        const wyczerpane = p.stock !== null && p.stock <= 0;
        const rozwinieta = otwarta === p.id;

        return (
          <div key={p.id} className="szklo rounded-md px-3.5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-bold">{p.name}</span>
              <span className="flex-none font-tytul text-lg leading-none tabular-nums">
                {p.price}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dym">{p.description}</p>

            {p.stock !== null && (
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.14em] text-dym">
                {wyczerpane ? "wyczerpane" : `zostało ${p.stock}`}
              </p>
            )}

            {!jestKapitanem && (
              <p className="mt-2.5 text-xs text-dym">
                {nazwaKapitana
                  ? `Kupuje ${nazwaKapitana}`
                  : "Drużyna nie ma jeszcze kapitana"}
              </p>
            )}

            {jestKapitanem && !rozwinieta && (
              <Button
                variant="szklo"
                className="mt-2.5"
                disabled={nieStac || wyczerpane}
                onClick={() => {
                  setOtwarta(p.id);
                  setBlad(null);
                }}
              >
                {wyczerpane ? "Wyczerpane" : nieStac ? "Za mało punktów" : "Kup"}
              </Button>
            )}

            {jestKapitanem && rozwinieta && (
              <div className="mt-2.5 grid gap-2.5">
                {p.requires_target && (
                  <label className="block">
                    <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
                      Na kogo
                    </span>
                    <select
                      value={cel}
                      onChange={(e) => setCel(e.target.value)}
                      className="szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc
                                 outline-none focus-visible:border-krew"
                    >
                      <option value="">— wybierz —</option>
                      {obceDruzyny.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {blad && <p className="text-sm text-krew-jasna">{blad}</p>}

                <Button onClick={() => void kup(p)} disabled={czeka === p.id}>
                  {czeka === p.id ? "Kupuję..." : `Potwierdź — ${p.price} pkt`}
                </Button>
                <Button
                  variant="cichy"
                  onClick={() => {
                    setOtwarta(null);
                    setBlad(null);
                  }}
                >
                  Rezygnuję
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
