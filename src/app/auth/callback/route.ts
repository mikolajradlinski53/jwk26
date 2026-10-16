import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bladLogowania, kodBleduLogowania } from "@/lib/auth/blad";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  function zBledem(surowy: string) {
    const url = new URL("/wejscie", origin);
    url.searchParams.set("blad", bladLogowania(surowy));
    const kod = kodBleduLogowania(surowy);
    url.searchParams.set("kod", kod);
    // Kod z maila nie przechodzi przez przekierowanie - działa w każdym oknie.
    if (kod === "inne_okno") url.searchParams.set("awaria", "1");
    return NextResponse.redirect(url);
  }

  // Google potrafi wrócić z błędem zamiast kodu - wtedy `code` nie ma wcale.
  const odmowa = searchParams.get("error_description") ?? searchParams.get("error");
  if (odmowa) return zBledem(odmowa);

  const code = searchParams.get("code");
  if (!code) return zBledem("brak kodu");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return zBledem(error.message);

  // Dokąd dalej, rozstrzyga bramka na podstawie statusu profilu.
  return NextResponse.redirect(new URL("/app", origin));
}
