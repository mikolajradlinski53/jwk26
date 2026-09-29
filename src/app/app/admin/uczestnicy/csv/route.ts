import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { doCsv } from "@/lib/csv";
import {
  NAGLOWKI_CSV,
  parsujFiltry,
  wczytajUczestnikow,
  wierszCsv,
} from "@/lib/zapisy/uczestnicy";

/**
 * Eksport listy przyjętych do CSV. Bramka w proxy.ts i tak wpuszcza pod
 * /app/admin wyłącznie admina, ale plik zawiera dane o zdrowiu, więc trasa
 * sprawdza rolę sama - nie polega na tym, że nikt nie zmieni matchera.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Brak sesji", { status: 401 });

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profil?.role !== "admin") return new NextResponse("Brak uprawnień", { status: 403 });

  try {
    const uczestnicy = await wczytajUczestnikow(supabase, parsujFiltry(request.nextUrl.searchParams));
    const csv = doCsv(NAGLOWKI_CSV, uczestnicy.map(wierszCsv));

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // Stała nazwa: filtry w nazwie pliku to nic, ale nazwiska - już tak.
        "Content-Disposition": 'attachment; filename="uczestnicy-jwk26.csv"',
        // Dane o zdrowiu nie mają prawa zostać w żadnym cache po drodze.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // Tylko kod i treść - szczegóły błędu Postgresa potrafią zawierać wiersz.
    const blad = e as { code?: string; message?: string };
    console.error("Eksport CSV uczestników nie przeszedł:", { code: blad.code, message: blad.message });
    return new NextResponse("Nie udało się przygotować pliku", { status: 500 });
  }
}
