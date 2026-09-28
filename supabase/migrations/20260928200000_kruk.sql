-- ============================================================
-- Sekta Wyjazdowa — kruk
-- ============================================================
--
-- Plan 14 (spec 2026-09-28-kruk-design.md). Lot przez szczeliny między
-- kolumnami, bez punktów — tylko ranking osób. Wynik zgłasza przeglądarka,
-- więc da się go ograniczyć, nie zweryfikować: baza pilnuje, żeby nie
-- przekraczał tego, co da się przelecieć od startu nadanego przez nią samą.
--
-- Osobna tabela, nie game_sessions: tam stake > 0 i obrót kasyna sumuje
-- stawki wszystkich gier, a kruk stawki nie ma.

create table kruk_gry (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  -- NULL, dopóki gra trwa.
  wynik       integer,
  finished_at timestamptz
);

create index kruk_gry_user_idx on kruk_gry (user_id);

alter table kruk_gry enable row level security;

-- Brak polityk i grantów jest treścią: jedyne wejście to dwie funkcje niżej,
-- a ranking wychodzi przez widok.
revoke all on kruk_gry from anon, authenticated;

-- ---------- Start ----------
-- Usuwa niedokończoną grę tej osoby: odświeżenie strony czy zamknięta apka
-- nie zostawiają śmieci, a każdy ma najwyżej jedną otwartą grę.
create function public.kruk_start()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_status public.user_status;
  v_id     uuid;
begin
  if v_user is null then
    raise exception 'Brak sesji';
  end if;

  select status into v_status from public.profiles where id = v_user;
  if v_status is distinct from 'approved'::public.user_status then
    raise exception 'Tylko zaakceptowani uczestnicy moga grac';
  end if;

  delete from public.kruk_gry where user_id = v_user and wynik is null;

  insert into public.kruk_gry (user_id) values (v_user)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------- Wynik ----------
-- Zwraca rekord osoby po tej grze. Odrzucony wynik nie zamyka gry — ponowne
-- zgłoszenie i tak podlega temu samemu limitowi czasu.
create function public.kruk_wynik(p_gra uuid, p_wynik integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Musi się równać ODSTEP_KOLUMN_S w src/lib/kruk/fizyka.ts (pilnuje tego test).
  c_odstep_kolumn_s constant numeric := 1.5;
  v_user    uuid := auth.uid();
  g         public.kruk_gry%rowtype;
  v_sekundy numeric;
  v_rekord  integer;
begin
  if v_user is null then
    raise exception 'Brak sesji';
  end if;

  select * into g from public.kruk_gry
  where id = p_gra and user_id = v_user
  for update;
  if not found then
    raise exception 'Nie ma takiej gry';
  end if;
  if g.wynik is not null then
    raise exception 'Wynik tej gry jest juz zapisany';
  end if;
  if p_wynik is null or p_wynik < 0 then
    raise exception 'Wynik nie moze byc ujemny';
  end if;

  -- Kolumny mijają kruka w stałym rytmie, więc więcej się przelecieć nie da.
  v_sekundy := extract(epoch from now() - g.started_at);
  if p_wynik > floor(v_sekundy / c_odstep_kolumn_s) + 1 then
    raise exception 'Wynik niemozliwy w tym czasie';
  end if;

  update public.kruk_gry
  set wynik = p_wynik, finished_at = now()
  where id = g.id;

  select max(wynik) into v_rekord from public.kruk_gry where user_id = v_user;
  return v_rekord;
end;
$$;

-- ---------- Ranking ----------
-- Prawami właściciela (jak moje_spiny): gracz nie ma grantu na kruk_gry.
-- Wychodzi tylko rekord osoby, bez pojedynczych gier i ich czasów.
create view kruk_ranking as
  select p.id as user_id,
         p.display_name,
         p.team_id,
         t.color,
         r.rekord,
         rank() over (order by r.rekord desc)::integer as miejsce
  from (
    select user_id, max(wynik) as rekord
    from kruk_gry
    where wynik is not null
    group by user_id
  ) r
  join profiles p on p.id = r.user_id
  left join teams t on t.id = p.team_id
  where p.status = 'approved';

revoke all on kruk_ranking from anon;
grant select on kruk_ranking to authenticated;

-- ---------- Uprawnienia ----------
revoke execute on function public.kruk_start() from public, anon;
grant  execute on function public.kruk_start() to authenticated;
revoke execute on function public.kruk_wynik(uuid, integer) from public, anon;
grant  execute on function public.kruk_wynik(uuid, integer) to authenticated;
