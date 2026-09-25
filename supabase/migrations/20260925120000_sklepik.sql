-- ============================================================
-- Sekta Wyjazdowa — sklepik
-- ============================================================
--
-- Pierwsze wyjście punktów z systemu. Do tej pory księga tylko rosła: bingo
-- dosypywało, admin dosypywał, nic nie odejmowało.

create type shop_kind         as enum ('digital', 'physical');
create type shop_order_status as enum ('pending', 'fulfilled', 'cancelled');
create type effect_scope      as enum ('user', 'team');

-- ---------- Półka ----------
create table shop_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null,
  kind            shop_kind not null,
  price           integer not null check (price > 0 and price <= 100000),
  -- NULL znaczy „bez limitu". CHECK jest twardym backstopem, gdyby arytmetyka
  -- w kup_z_polki kiedykolwiek się pomyliła — lepiej błąd niż ujemny stan.
  stock           integer check (stock is null or stock >= 0),
  active          boolean not null default true,
  effect_key      text,
  effect_value    integer,
  effect_hours    integer check (effect_hours is null or effect_hours > 0),
  requires_target boolean not null default false,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  -- Równoważność, nie implikacja. Pozycja fizyczna z effect_key byłaby cicho
  -- martwym efektem: nikt by go nie wykonał, a nazwa sugerowałaby, że działa.
  constraint shop_items_effect_matches_kind
    check ((kind = 'digital') = (effect_key is not null))
);

-- ---------- Zamówienia ----------
create table shop_orders (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams(id) on delete cascade,
  -- restrict, nie cascade: usunięcie pozycji z półki nie może wymazać historii
  -- tego, że ktoś ją kiedyś kupił za punkty.
  item_id        uuid not null references shop_items(id) on delete restrict,
  -- Snapshot ceny. Cena pozycji może się zmienić, a kronika i zwrot muszą
  -- operować na tym, co realnie zapłacono. Ta sama zasada, co team_id w księdze.
  price_paid     integer not null,
  ordered_by     uuid references profiles(id) on delete set null,
  target_team_id uuid references teams(id) on delete set null,
  status         shop_order_status not null default 'pending',
  fulfilled_by   uuid references profiles(id) on delete set null,
  fulfilled_at   timestamptz,
  note           text,
  created_at     timestamptz not null default now()
);

create index shop_orders_kolejka_idx on shop_orders (status, created_at desc);

-- ---------- Efekty ----------
-- consumed_at i order_id to odstępstwo od §4 specu głównego. Wszystkie trzy
-- perki są jednorazowe: bez consumed_at zużyty efekt albo nie kończy się nigdy,
-- albo trzeba go usunąć — a usuwanie kasuje ślad, na którym stoi cały ten
-- schemat. order_id wiąże efekt z zakupem, który go opłacił.
create table active_effects (
  id           uuid primary key default gen_random_uuid(),
  scope        effect_scope not null,
  subject_id   uuid not null,
  effect_key   text not null,
  effect_value integer,
  expires_at   timestamptz,
  consumed_at  timestamptz,
  order_id     uuid references shop_orders(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index active_effects_szukaj_idx
  on active_effects (subject_id, effect_key)
  where consumed_at is null;

-- ---------- Outbox powiadomień ----------
-- W tym kroku nikt tej tabeli nie opróżnia. Transport (web push, SMS) powstaje
-- w kroku 8 i wtedy obsłuży naraz sklepik, kolejkę bingo, rejestracje
-- i broadcast. Zbudowany teraz pod jeden przypadek zostałby przepisany.
create table powiadomienia (
  id         bigint generated always as identity primary key,
  kanal      text not null default 'in_app' check (kanal in ('in_app', 'push', 'sms')),
  adresat    text not null check (adresat in ('admin', 'team', 'user')),
  adresat_id uuid,
  tytul      text not null,
  body       text,
  ref_type   text,
  ref_id     text,
  created_at timestamptz not null default now(),
  wyslane_at timestamptz
);

-- ---------- Kronika ----------
-- security_invoker = on, jak team_scores i user_scores: bez tego widok czytałby
-- tabele prawami właściciela i obszedłby RLS.
create view kronika_sklepiku with (security_invoker = on) as
  select o.id, o.created_at, o.status, o.price_paid, o.note,
         i.name  as item_name,
         i.kind  as item_kind,
         t.name  as team_name,
         t.color as team_color,
         c.name  as target_team_name,
         p.display_name as ordered_by_name
  from shop_orders o
  join shop_items i on i.id = o.item_id
  join teams t      on t.id = o.team_id
  left join teams c on c.id = o.target_team_id
  left join profiles p on p.id = o.ordered_by;

-- ---------- Predykat kapitana ----------
-- Osobna funkcja, a nie warunek wklejony w kup_z_polki: ten sam warunek trafi
-- kiedyś do polityk RLS i do kasyna. Konwencja jak is_admin() i is_approved().
create function public.is_captain(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team and captain_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table shop_items     enable row level security;
alter table shop_orders    enable row level security;
alter table active_effects enable row level security;
alter table powiadomienia  enable row level security;

create policy shop_items_read on shop_items
  for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy shop_items_admin_write on shop_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Kronika jest jawna globalnie, nie tylko dla własnej drużyny. Tabela ryzyk
-- speca głównego wymaga jawności wobec drużyny jako rozbrojenia kapitana
-- przepuszczającego dorobek; globalna spełnia to z nawiązką i robi z klątwy
-- akt publiczny. Nic wrażliwego tu nie ma — to lista rzeczy kupionych za punkty.
create policy shop_orders_read on shop_orders
  for select to authenticated
  using (public.is_approved() or public.is_admin());

-- Brak polityki INSERT/UPDATE/DELETE jest tu treścią, nie przeoczeniem:
-- jedyne wejście do zapisu to funkcje SECURITY DEFINER niżej.

create policy active_effects_read on active_effects
  for select to authenticated
  using (public.is_approved() or public.is_admin());

-- Powiadomienia są adresowane do admina, więc uczestnik nie ma powodu ich czytać.
create policy powiadomienia_read on powiadomienia
  for select to authenticated
  using (public.is_admin());

-- ============================================================
-- Realtime
-- ============================================================
-- Bez tej linii licznik zamówień w Sanktuarium nie drgnie nigdy, a kod klienta
-- będzie wyglądał poprawnie. Do tej pory w publikacji był tylko points_ledger.
alter publication supabase_realtime add table shop_orders;

-- ============================================================
-- Zasiew półki
-- ============================================================
-- Ceny wyliczone ze skali bingo: zadanie 20 pkt, dwanaście linii po 50, plansza
-- 200 — pełna plansza daje drużynie maksymalnie 1300. Cennik siedzi więc
-- w przedziale 35-250, żeby drużyna kupiła przez wyjazd kilka rzeczy, a nie
-- jedną albo dwadzieścia. Do podmiany zapytaniem, bez wdrożenia.
--
-- Rejestr nazw jest liturgiczny, opis mówi wprost, co przyjdzie: komizm ma brać
-- się z kontrastu formy z treścią, jak w zadaniach bingo.
insert into shop_items
  (name, description, kind, price, stock, effect_key, effect_value, effect_hours,
   requires_target, position)
values
  ('Woda Święcona',    'Pół litra wódki',                    'physical', 250,    4, null, null, null, false,  1),
  ('Manna',            'Pizza dowieziona dla drużyny',       'physical', 220,    4, null, null, null, false,  2),
  ('Napar Braterski',  'Sześciopak piwa',                    'physical', 180,    6, null, null, null, false,  3),
  ('Krew Ofiarna',     'Butelka wina, 0,7 l',                'physical', 160,    6, null, null, null, false,  4),
  ('Namaszczenie',     'Shot dla każdego w drużynie',        'physical', 120,    8, null, null, null, false,  5),
  ('Chleb Powszedni',  'Paczka przekąsek',                   'physical',  50,   20, null, null, null, false,  6),
  ('Kielich',          'Jedno piwo',                         'physical',  40,   40, null, null, null, false,  7),
  ('Eliksir Czuwania', 'Energetyk',                          'physical',  35,   20, null, null, null, false,  8),
  ('Błogosławieństwo', 'Podwójne punkty za następne przyjęte zdjęcie. Ważne trzy godziny.',
                                                             'digital',  120, null, 'blogoslawienstwo', 2,    3, false, 20),
  ('Tarcza',           'Pochłania następną klątwę rzuconą w waszą drużynę.',
                                                             'digital',  150, null, 'tarcza',        null, null, false, 21),
  ('Klątwa',           'Wskazana drużyna traci pięćdziesiąt punktów. Natychmiast.',
                                                             'digital',  200, null, 'klatwa',          50, null,  true, 22);
