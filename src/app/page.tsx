import { redirect } from "next/navigation";

// Tymczasowe: w Tasku 8 to miejsce zajmuje landing. Do tego czasu korzeń
// odsyła do apki, żeby nie był martwy — wraca tu każdy po zalogowaniu
// i każdy, kto przypiął apkę, zanim start_url wskazał /app.
export default function Korzen() {
  redirect("/app");
}
