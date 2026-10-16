import { redirect } from "next/navigation";

/**
 * Gra terenowa mieszka od 2026-10-15 w zakładce Bingo (przełącznik). Ten adres
 * zostaje, bo prowadzą do niego wysłane już powiadomienia o zadaniach.
 */
export default function GraPage() {
  redirect("/app/bingo?widok=gra");
}
