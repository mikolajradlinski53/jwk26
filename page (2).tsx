import Leaderboard from "@/components/Leaderboard";

export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1>🕯️ Ranking Sekt</h1>
      <p style={{ opacity: 0.7 }}>Aktualizuje się na żywo.</p>
      <Leaderboard />
    </main>
  );
}
