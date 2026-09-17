import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/gate";

// Next 16: następca middleware.ts. Eksport musi nazywać się `proxy`
// albo być domyślny; config.matcher działa bez zmian.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Jeden prefiks zamiast listy wyjątków. Wszystko poza `/app` jest publiczne
  // z założenia, a nie przez to, że ktoś pamiętał dopisać wyjątek — na tej
  // liście trzykrotnie trzeba było robić miejsce dla tras podglądu, a dwa razy
  // wykluczenie okazało się szersze, niż zamierzano.
  matcher: ["/app/:path*"],
};
