import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/gate";

// Next 16: następca middleware.ts. Eksport musi nazywać się `proxy`
// albo być domyślny; config.matcher działa bez zmian.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // `icon` i `apple-icon` to trasy generowane przez Next z plików icon.tsx
  // i apple-icon.tsx — w adresie nie mają rozszerzenia, więc nie łapie ich
  // wykluczenie plików graficznych poniżej. Bez wpisania ich wprost bramka
  // odsyłała niezalogowanego na /login, a Safari przy „Dodaj do ekranu
  // początkowego" jest niezalogowane: zamiast znaku apki pobierało HTML
  // strony logowania i stawiało na ekranie zrzut strony.
  //
  // Ta czarna lista znika w Tasku 4 planu 05, gdy apka przeniesie się pod
  // /app i matcher zwęzi się do jednego prefiksu.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
