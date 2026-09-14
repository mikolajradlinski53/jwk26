import { createBrowserClient } from "@supabase/ssr";

// Klient do komponentów 'use client' — trzyma sesję w cookies,
// obsługuje realtime (websocket) i zwykłe zapytania z JWT usera.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
