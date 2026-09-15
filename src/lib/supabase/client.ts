import { createBrowserClient } from "@supabase/ssr";

// Klient dla komponentów "use client": sesja w cookies, realtime po websocketach.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
