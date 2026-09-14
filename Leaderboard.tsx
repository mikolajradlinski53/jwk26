"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { team_id: string; name: string; color: string | null; score: number };

// Ranking na żywo. Model realtime:
//  - subskrybujemy INSERT-y do points_ledger (każde przyznanie/wydanie punktów),
//  - na każdą zmianę re-fetchujemy widok team_scores (przy 4 teamach to nic).
export default function Leaderboard() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);

  async function refetch() {
    const { data } = await supabase
      .from("team_scores")
      .select("*")
      .order("score", { ascending: false });
    if (data) setRows(data as Row[]);
  }

  useEffect(() => {
    refetch();

    const channel = supabase
      .channel("ledger-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "points_ledger" },
        () => refetch(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ol style={{ listStyle: "none", padding: 0 }}>
      {rows.map((r, i) => (
        <li
          key={r.team_id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 12,
            marginBottom: 8,
            borderLeft: `6px solid ${r.color ?? "#666"}`,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <span>#{i + 1} &nbsp; {r.name}</span>
          <strong>{r.score} pkt</strong>
        </li>
      ))}
    </ol>
  );
}
