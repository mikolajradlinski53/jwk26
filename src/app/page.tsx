import { RitualFrame } from "@/components/RitualFrame";
import { Button } from "@/components/ui/Button";

// Tymczasowa strona weryfikująca design system. Zastąpiona rankingiem w Tasku 11.
export default function Home() {
  return (
    <RitualFrame title="Sekta Wyjazdowa">
      <p className="text-center leading-relaxed text-smoke">Rytuał trwa.</p>
      <div className="mt-8 grid gap-3">
        <Button>Przyznaj punkty</Button>
        <Button variant="ghost">Opuść sektę</Button>
        <Button variant="danger">Odbierz punkty</Button>
      </div>
    </RitualFrame>
  );
}
