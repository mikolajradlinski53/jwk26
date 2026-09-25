-- ============================================================
-- Sekta Wyjazdowa — fundament kasyna
-- ============================================================
--
-- Tabela wspólna dla wszystkich trzech gier. Sloty używają jej najprościej:
-- jeden wiersz na spin, rozliczony w tej samej transakcji, w której powstał.

create table game_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  -- Zwykły text, nie enum: kolejne gry dopisują tu własne wartości i nie ma
  -- powodu, żeby każda wymagała ALTER TYPE w migracji.
  game       text not null,
  stake      integer not null check (stake > 0),
  payout     integer not null default 0 check (payout >= 0),
  state      jsonb,
  status     text not null default 'settled',
  created_at timestamptz not null default now()
);

-- Indeks pod okno 24 h: to jedyne zapytanie wykonywane przy każdym spinie.
create index game_sessions_okno_idx on game_sessions (user_id, created_at desc);

alter table game_sessions enable row level security;

create policy game_sessions_read_self on game_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Brak polityki INSERT/UPDATE/DELETE jest treścią, nie przeoczeniem: jedyne
-- wejście do zapisu to zakrec_slotami() w osobnej migracji.

-- ---------- Granty kolumnowe ----------
-- `state` nie wychodzi do nikogo. Ten sam idiom, którym profiles broni się przed
-- podniesieniem sobie role='admin'.
--
-- Robimy to teraz, a nie przy blackjacku, bo to blackjack wsadzi tu nierozdane
-- karty i wtedy odczyt tej kolumny stanie się podglądaniem następnej karty.
-- Zamknięte od początku nie wymaga pamiętania o niczym, a slotom nic nie odbiera.
--
-- Granty działają na rolę, nie na politykę, więc obejmują też admina — admin,
-- który będzie musiał obejrzeć `state` przy sporze, zrobi to kluczem serwisowym.
revoke select on game_sessions from anon, authenticated;
grant  select (id, user_id, game, stake, payout, status, created_at)
  on game_sessions to authenticated;

-- ---------- Widok własnych spinów ----------
-- Jedyne miejsce, w którym symbole wychodzą do gracza.
--
-- **Bez** security_invoker, czyli prawami właściciela — odwrotnie niż
-- team_scores i kronika_sklepiku. Musi tak być: widok z security_invoker = on
-- wykonuje się prawami wywołującego, a ten nie ma grantu na `state`, więc taki
-- widok też by go nie odczytał.
--
-- Konsekwencja jest poważna: RLS tabeli bazowej tego widoku **nie chroni**.
-- Warunek user_id = auth.uid() w ciele widoku jest całą ochroną cudzej historii.
create view moje_spiny as
  select id,
         game,
         stake,
         payout,
         status,
         created_at,
         state -> 'bebny' as bebny
  from game_sessions
  where user_id = auth.uid()
    and game = 'sloty';

grant select on moje_spiny to authenticated;

-- ---------- Ustawienia ----------
-- slots_rtp wylatuje. RTP nie jest pokrętłem, jest konsekwencją tabeli wypłat;
-- wiersz, który wygląda na nastawę, a którego zmiana nic nie robi, jest gorszy
-- niż jego brak, bo pierwsza osoba, która wpisze tam 0.95, uzna, że coś ustawiła.
delete from app_settings where key = 'slots_rtp';

-- Prawdziwe pokrętła. Po zmianie którejkolwiek wypłaty przelicz RTP wzorem:
--
--   RTP = (1 × trojka_oko + 5 × trojka + 90 × para) / 216 / slots_stawka
--
-- Przy wartościach poniżej: (400 + 600 + 900) / 216 / 10 = 0,8796.
insert into app_settings (key, value) values
  ('slots_stawka',  '10'),
  ('slots_wyplaty', '{"trojka_oko": 400, "trojka": 120, "para": 10}'::jsonb)
on conflict (key) do nothing;
