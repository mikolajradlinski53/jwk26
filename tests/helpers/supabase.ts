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

/** Id zadania bingo po pozycji na planszy (0-24) — zasiane na stałe w migracji. */
export async function idZadania(position: number): Promise<string> {
  const { data, error } = await admin
    .from("bingo_tasks")
    .select("id")
    .eq("position", position)
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Minimalne poprawne zgłoszenie bingo dla danego użytkownika, drużyny i zadania. */
export function zgloszenieBingoDla(user: TestUser, teamId: string, taskId: string) {
  return {
    user_id: user.id,
    team_id: teamId,
    task_id: taskId,
    photo_path: `${user.id}/zdjecie.jpg`,
  };
}

/**
 * Zapala wskazane pola planszy dla drużyny, omijając review_bingo.
 *
 * Wstawia zgłoszenia od razu jako `approved`, bez `reviewed_by`/`reviewed_at` —
 * to stan, do którego aplikacja dochodzi wyłącznie przez funkcję akceptacji.
 * Skrót jest bezpieczny, bo wykrywanie linii i pełnej planszy patrzy tylko na
 * `status`, nigdy na pola recenzenta. Dzięki temu test bonusu za linię nie musi
 * przepuszczać czterech zgłoszeń przez funkcję, żeby dojść do tego piątego,
 * które faktycznie bada.
 */
export async function zapal(
  teamId: string,
  userId: string,
  pozycje: number[],
): Promise<void> {
  const { data: zadania, error: bladZadan } = await admin
    .from("bingo_tasks")
    .select("id")
    .in("position", pozycje);
  if (bladZadan) throw bladZadan;

  for (const z of zadania ?? []) {
    const { error } = await admin.from("bingo_submissions").insert({
      team_id: teamId,
      user_id: userId,
      task_id: z.id,
      photo_path: `${userId}/${crypto.randomUUID()}.jpg`,
      status: "approved",
    });
    if (error) throw error;
  }
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
