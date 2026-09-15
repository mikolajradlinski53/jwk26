-- ============================================================
-- Sekta Wyjazdowa — schemat początkowy
-- ============================================================

create type user_role   as enum ('member', 'admin');
create type user_status as enum ('pending', 'approved', 'rejected');

-- ---------- Drużyny ----------
create table teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  color      text not null default '#c9a227',
  motto      text,
  captain_id uuid,                        -- FK dopięty po utworzeniu profiles
  created_at timestamptz not null default now()
);

-- ---------- Profile ----------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  phone        text,
  sms_consent  boolean not null default false,
  team_id      uuid references teams(id) on delete set null,
  role         user_role   not null default 'member',
  status       user_status not null default 'pending',
  notes        text,
  created_at   timestamptz not null default now()
);

alter table teams
  add constraint teams_captain_fk
  foreign key (captain_id) references profiles(id) on delete set null;

-- ---------- Bramka domenowa ----------
-- Twardy backstop niezależny od walidacji w interfejsie.
create function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Warunek na NULL jest konieczny: rejestracja przez numer telefonu zostawia
  -- email pusty, a NULL not like '...' daje NULL, czyli warunek by nie zadziałał.
  if new.email is null or lower(new.email) not like '%@samorzad.ue.wroc.pl' then
    raise exception 'Dozwolone wyłącznie adresy @samorzad.ue.wroc.pl';
  end if;
  return new;
end;
$$;

create trigger enforce_email_domain_trg
  before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- ---------- Automatyczny profil ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Pomocnicze predykaty ----------
-- SECURITY DEFINER, żeby czytanie profiles nie wpadło w rekurencję polityk RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

-- ---------- Księga punktów (tylko do dopisywania) ----------
-- user_id NULL        => wydatek drużynowy (sklepik), nie obciąża wyniku kapitana
-- user_id ustawiony   => zarobek lub strata indywidualna
create table points_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles(id) on delete set null,
  team_id    uuid not null references teams(id) on delete cascade,
  delta      integer not null,
  category   text not null,
  reason     text,
  ref_type   text,
  ref_id     text,
  awarded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index points_ledger_team_idx    on points_ledger (team_id);
create index points_ledger_user_idx    on points_ledger (user_id);
create index points_ledger_created_idx on points_ledger (created_at desc);

-- ---------- Widoki wyników ----------
create view team_scores with (security_invoker = on) as
  select t.id as team_id, t.name, t.slug, t.color,
         coalesce(sum(l.delta), 0)::int as score
  from teams t
  left join points_ledger l on l.team_id = t.id
  group by t.id, t.name, t.slug, t.color;

create view user_scores with (security_invoker = on) as
  select p.id as user_id, p.display_name, p.team_id,
         t.name as team_name, t.color,
         coalesce(sum(l.delta), 0)::int as score
  from profiles p
  left join points_ledger l on l.user_id = p.id
  left join teams t on t.id = p.team_id
  where p.status = 'approved'
  group by p.id, p.display_name, p.team_id, t.name, t.color;

-- ---------- Ustawienia strojone bez deploya ----------
create table app_settings (
  key   text primary key,
  value jsonb not null
);

insert into app_settings (key, value) values
  ('casino_daily_stake_cap',    '300'),
  ('slots_rtp',                 '0.88'),
  ('gossip_min_justification',  '200'),
  ('ocr_min_confidence',        '0.35');

-- ============================================================
-- RLS
-- ============================================================

alter table teams          enable row level security;
alter table profiles       enable row level security;
alter table points_ledger  enable row level security;
alter table app_settings   enable row level security;

-- Drużyny: czyta każdy zalogowany, pisze wyłącznie admin.
create policy teams_read on teams
  for select to authenticated using (true);

create policy teams_admin_write on teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profile: swój zawsze; cudze dopiero po akceptacji; admin wszystko.
create policy profiles_read on profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_approved() or public.is_admin());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_write on profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sama polityka UPDATE nie wystarczy: bez tego uczestnik podniósłby sobie
-- role='admin' albo status='approved' we własnym wierszu. Granty kolumnowe
-- zawężają UPDATE do pól, które faktycznie należą do użytkownika.
--
-- Konsekwencja, o której trzeba pamiętać: granty działają na rolę, nie na
-- politykę, więc obejmują także adminów — admin też nie zmieni tu status ani
-- team_id zwykłym UPDATE-em. Akceptacja zgłoszeń i przypisanie do drużyny idą
-- przez funkcję SECURITY DEFINER (plan 02), zgodnie z decyzją D1 ze speca.
revoke update on profiles from authenticated;
grant update (display_name, phone, sms_consent) on profiles to authenticated;

-- Księga: czytają wszyscy zaakceptowani (jawność), dopisuje wyłącznie admin.
-- Brak polityk UPDATE i DELETE — historii nie da się zmienić ani skasować.
create policy ledger_read on points_ledger
  for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy ledger_admin_insert on points_ledger
  for insert to authenticated
  with check (public.is_admin());

-- Ustawienia: czyta każdy zalogowany, zmienia admin.
create policy settings_read on app_settings
  for select to authenticated using (true);

create policy settings_admin_write on app_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table points_ledger;

-- ---------- Zasiew ----------
-- Rusztowanie do podmiany w panelu admina; liczba drużyn nie jest zaszyta nigdzie w kodzie.
insert into teams (name, slug, color, motto) values
  ('Zakon Popiołu', 'popiol', '#c9a227', 'Z prochu powstaliśmy'),
  ('Krąg Świec',    'swiece', '#e0b64a', 'Płomień nie gaśnie'),
  ('Bractwo Krwi',  'krew',   '#8b1e1e', 'Więzy ponad wszystko'),
  ('Loża Szeptu',   'szept',  '#8a8172', 'Słyszymy wszystko');
