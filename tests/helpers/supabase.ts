import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Brak zmiennych TEST_SUPABASE_*. Uzupełnij .env.test (patrz .env.example).",
  );
}

/** Klient omijający RLS — do przygotowania i sprzątania danych. */
export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "rytual-testowy-2026";

/** Unikalny adres w dozwolonej domenie — kolizje między uruchomieniami bolą. */
export function testEmail(tag: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `test.${tag}.${nonce}@samorzad.ue.wroc.pl`;
}

export type TestUser = { id: string; email: string };

/** Zakłada użytkownika i zwraca jego identyfikatory. */
export async function createUser(tag: string): Promise<TestUser> {
  const email = testEmail(tag);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email };
}

/** Klient działający z uprawnieniami danego użytkownika — tak widzi go RLS. */
export async function signIn(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

export async function deleteUser(user: TestUser): Promise<void> {
  await admin.auth.admin.deleteUser(user.id);
}

/** Identyfikator pierwszej zasianej drużyny — przydaje się w niemal każdym teście. */
export async function firstTeamId(): Promise<string> {
  const { data, error } = await admin
    .from("teams")
    .select("id")
    .order("name")
    .limit(1)
    .single();
  if (error) throw error;
  return data.id as string;
}
