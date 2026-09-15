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

/** Nadaje rolę admina — omija granty kolumnowe, bo idzie kluczem serwisowym. */
export async function makeAdmin(user: TestUser): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id);
  if (error) throw error;
}

/**
 * Ustawia status 'approved' bez przechodzenia przez review_registration.
 * Nazwa mówi „ustaw", nie „zaakceptuj", bo funkcja omija całą ścieżkę akceptacji:
 * klucz serwisowy nie podlega grantom kolumnowym, które blokują te pola roli
 * `authenticated`. Drużyna jest opcjonalna — bywa testowi obojętna.
 */
export async function ustawJakoZaakceptowany(
  user: TestUser,
  teamId?: string,
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ status: "approved", ...(teamId ? { team_id: teamId } : {}) })
    .eq("id", user.id);
  if (error) throw error;
}

/** Klient bez sesji — tak bazę widzi ktoś niezalogowany. */
export function anonimowy(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Minimalne poprawne zgłoszenie dla danego użytkownika. */
export function zgloszenieDla(user: TestUser) {
  return {
    user_id: user.id,
    full_name: "Brat Testowy",
    phone: "600100200",
    sms_consent: true,
    proof_path: `${user.id}/dowod.jpg`,
  };
}

/**
 * Rejestr użytkowników do posprzątania po teście. Każdy plik testowy trzymał
 * dotąd własną kopię tej pętli — przy piątej kopii przestało to być zabawne.
 */
export function sprzatanieUzytkownikow() {
  const kolejka: TestUser[] = [];

  async function nowyUzytkownik(tag: string): Promise<TestUser> {
    const user = await createUser(tag);
    kolejka.push(user);
    return user;
  }

  async function nowyAdmin(tag: string): Promise<TestUser> {
    const user = await nowyUzytkownik(tag);
    await makeAdmin(user);
    return user;
  }

  async function posprzataj(): Promise<void> {
    while (kolejka.length) {
      // Zdejmujemy z kolejki dopiero po udanym skasowaniu — inaczej wyjątek
      // w deleteUser zostawiłby osieroconego użytkownika w zdalnej bazie.
      const user = kolejka[kolejka.length - 1];
      // Redundantne wobec kaskady z profiles — zostawione jako polisa.
      await admin.from("registrations").delete().eq("user_id", user.id);
      await deleteUser(user);
      kolejka.pop();
    }
  }

  return { nowyUzytkownik, nowyAdmin, posprzataj };
}
