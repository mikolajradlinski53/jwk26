import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/gate";

// Next 16: następca middleware.ts. Eksport musi nazywać się `proxy`
// albo być domyślny; config.matcher działa bez zmian.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
