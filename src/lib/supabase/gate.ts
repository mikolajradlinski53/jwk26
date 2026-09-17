import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Jedyna trasa dostępna osobie czekającej na akceptację.
const POCZEKALNIA = "/app/rejestracja";
// Dokąd trafia zaakceptowany: ranking.
const DOM = "/app";

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

  if (!user) return przekieruj(request, "/wejscie", response);

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

  if (status !== "approved") {
    if (sciezka === POCZEKALNIA) return response;
    return przekieruj(request, POCZEKALNIA, response);
  }

  // Zaakceptowany na /app/rejestracja — formularz ma już za sobą.
  if (sciezka === POCZEKALNIA) return przekieruj(request, DOM, response);

  if (zaczynaSie(sciezka, ["/app/admin"]) && profile?.role !== "admin") {
    return przekieruj(request, DOM, response);
  }

  return response;
}

/**
 * Przekierowuje, nie gubiąc odświeżonej sesji.
 *
 * Supabase potrafi odświeżyć token w trakcie `getUser()` i zapisuje nowe
 * ciasteczka w `zrodlo`. Wcześniejsza wersja budowała czystą odpowiedź
 * przekierowania i te ciasteczka przepadały — przeglądarka zostawała ze starym,
 * właśnie zużytym tokenem odświeżającym. Ratowało nas tylko okno tolerancji
 * GoTrue na ponowne użycie tokenu; poza tym oknem człowiek wypadał z sesji
 * w losowym momencie, bez żadnego wzorca, który dałoby się zgłosić.
 */
function przekieruj(
  request: NextRequest,
  sciezka: string,
  zrodlo: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = sciezka;
  url.search = "";

  const odpowiedz = NextResponse.redirect(url);
  for (const ciastko of zrodlo.cookies.getAll()) {
    odpowiedz.cookies.set(ciastko);
  }
  return odpowiedz;
}
