import { RitualFrame } from "@/components/RitualFrame";
import { Button } from "@/components/ui/Button";

// Zastąpione przez formularz z OCR w planie 02.
export default function RejestracjaPage() {
  return (
    <RitualFrame title="Próba">
      <p className="text-center leading-relaxed text-smoke">
        Twoje wtajemniczenie czeka na potwierdzenie.
      </p>

      <form action="/auth/signout" method="post" className="mt-10">
        <Button variant="ghost" type="submit" className="w-full">
          Wyloguj
        </Button>
      </form>
    </RitualFrame>
  );
}
