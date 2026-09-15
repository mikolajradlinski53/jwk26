import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Trasy dostępne bez zalogowania.
const PUBLICZNE = ["/login", "/auth"];
// Jedyna trasa dostępna osobie czekającej na akceptację.
const POCZEKALNIA = "/rejestracja";

function zaczynaSie(sciezka: string, prefiksy: string[]) {
  return prefiksy.some((p) => sciezka === p || sciezka.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() weryfikuje token u dostawcy — getSession() ufa cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sciezka = request.nextUrl.pathname;

  if (!user) {
    if (zaczynaSie(sciezka, PUBLICZNE)) return response;
    return przekieruj(request, "/login");
  }

  // Zalogowany na /login nie ma tam czego szukać.
  if (sciezka === "/login") return przekieruj(request, "/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

  if (status !== "approved") {
    if (sciezka === POCZEKALNIA) return response;
    return przekieruj(request, POCZEKALNIA);
  }

  // Zaakceptowany na /rejestracja — formularz ma już za sobą.
  if (sciezka === POCZEKALNIA) return przekieruj(request, "/");

  if (zaczynaSie(sciezka, ["/admin"]) && profile?.role !== "admin") {
    return przekieruj(request, "/");
  }

  return response;
}

function przekieruj(request: NextRequest, sciezka: string) {
  const url = request.nextUrl.clone();
  url.pathname = sciezka;
  url.search = "";
  return NextResponse.redirect(url);
}
