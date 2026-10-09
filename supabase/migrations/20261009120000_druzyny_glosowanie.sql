-- ============================================================
-- Sekta Wyjazdowa — drużyny bez nazw i głosowanie na kapitana
-- ============================================================
--
-- Spec 2026-10-09-druzyny-kapitan-nazwa-design.md. `teams.name` zawsze ma
-- co pokazać („Drużyna N”, dopóki kapitan nie nada nazwy), więc ranking,
-- feed, sklepik, panele i eksport działają bez zmian.

alter table teams
  add column numer        smallint unique,
  add column nazwa_nadana boolean not null default false,
  add column glosowanie   text not null default 'nie_rozpoczete'
    check (glosowanie in ('nie_rozpoczete', 'trwa', 'zakonczone'));

-- Nazwy, motta i kapitanowie zasiani w testach znikają; kolory zostają.
with kolejnosc as (
  select id, row_number() over (order by name) as n from teams
)
update teams t set numer = k.n from kolejnosc k where t.id = k.id;

update teams
set name = 'Drużyna ' || numer, motto = null, captain_id = null,
    nazwa_nadana = false, glosowanie = 'nie_rozpoczete';

-- ---------- Głosy ----------
-- Jeden głos na osobę (klucz główny), do zmiany do zamknięcia. Tajne:
-- uczestnik nie czyta tabeli, liczby podaje stan_glosowania().
create table glosy_kapitan (
  voter_id    uuid primary key references profiles(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  kandydat_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table glosy_kapitan enable row level security;
revoke all on glosy_kapitan from anon, authenticated;

-- Głosy, które się liczą: głosujący i kandydat są nadal przyjęci i w tej
-- drużynie (ktoś przeniesiony albo odrzucony w trakcie przestaje się liczyć).
create function public.glosy_waznych(p_team uuid)
returns table (kandydat_id uuid, n bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.kandydat_id, count(*)
  from public.glosy_kapitan g
  join public.profiles v on v.id = g.voter_id and v.team_id = p_team and v.status = 'approved'
  join public.profiles k on k.id = g.kandydat_id and k.team_id = p_team and k.status = 'approved'
  where g.team_id = p_team
  group by g.kandydat_id;
$$;

revoke execute on function public.glosy_waznych(uuid) from public, anon, authenticated;

create function public.czlonkow_druzyny(p_team uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.profiles where team_id = p_team and status = 'approved';
$$;

revoke execute on function public.czlonkow_druzyny(uuid) from public, anon, authenticated;

-- ---------- Stan dla uczestnika ----------
create function public.stan_glosowania()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_t    public.teams%rowtype;
  v_moj  uuid;
begin
  select team_id into v_team from public.profiles where id = auth.uid() and status = 'approved';
  if v_team is null then
    return null;
  end if;
  select * into v_t from public.teams where id = v_team;
  select kandydat_id into v_moj from public.glosy_kapitan where voter_id = auth.uid() and team_id = v_team;
  return jsonb_build_object(
    'team_id', v_t.id,
    'numer', v_t.numer,
    'nazwa', v_t.name,
    'nazwa_nadana', v_t.nazwa_nadana,
    'etap', v_t.glosowanie,
    'kapitan_id', v_t.captain_id,
    'czlonkow', public.czlonkow_druzyny(v_team),
    'glosow', coalesce((select sum(n) from public.glosy_waznych(v_team)), 0),
    'moj_glos', v_moj
  );
end;
$$;

revoke execute on function public.stan_glosowania() from public, anon;
grant execute on function public.stan_glosowania() to authenticated;

-- ---------- Zamknięcie (wewnętrzne) ----------
-- Remis: losowanie spośród kandydatów z maksimum. Bez głosów etap się kończy,
-- a kapitana wskazuje admin ręcznie.
create function public.zamknij_glosowanie_druzyny(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kapitan uuid;
  v_imie    text;
begin
  update public.teams set glosowanie = 'zakonczone' where id = p_team and glosowanie = 'trwa';
  if not found then
    return;
  end if;

  select w.kandydat_id into v_kapitan
  from public.glosy_waznych(p_team) w
  where w.n = (select max(n) from public.glosy_waznych(p_team))
  order by random()
  limit 1;

  if v_kapitan is null then
    return;
  end if;

  update public.teams set captain_id = v_kapitan where id = p_team;
  select coalesce(display_name, 'Ktoś z drużyny') into v_imie from public.profiles where id = v_kapitan;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', p_team, 'Macie kapitana',
          v_imie || ' poprowadzi drużynę. Czas na nazwę!', '/app', 'kapitan', p_team::text);
end;
$$;

revoke execute on function public.zamknij_glosowanie_druzyny(uuid) from public, anon, authenticated;

-- ---------- Głos ----------
-- `for update` na drużynie: dwa ostatnie głosy w tej samej chwili idą po
-- kolei, więc drugi zobaczy komplet i zamknie głosowanie.
create function public.oddaj_glos_na_kapitana(p_kandydat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ja   uuid := auth.uid();
  v_team uuid;
  v_etap text;
begin
  select team_id into v_team from public.profiles where id = v_ja and status = 'approved';
  if v_team is null then
    raise exception 'Glosuja tylko przyjeci uczestnicy z druzyna';
  end if;

  select glosowanie into v_etap from public.teams where id = v_team for update;
  if v_etap is distinct from 'trwa' then
    raise exception 'Glosowanie nie trwa';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_kandydat and team_id = v_team and status = 'approved'
  ) then
    raise exception 'Kandydat spoza twojej druzyny';
  end if;

  insert into public.glosy_kapitan (voter_id, team_id, kandydat_id)
  values (v_ja, v_team, p_kandydat)
  on conflict (voter_id) do update
    set team_id = excluded.team_id, kandydat_id = excluded.kandydat_id, updated_at = now();

  if coalesce((select sum(n) from public.glosy_waznych(v_team)), 0) >= public.czlonkow_druzyny(v_team) then
    perform public.zamknij_glosowanie_druzyny(v_team);
  end if;
end;
$$;

revoke execute on function public.oddaj_glos_na_kapitana(uuid) from public, anon;
grant execute on function public.oddaj_glos_na_kapitana(uuid) to authenticated;

-- ---------- Admin ----------
create function public.rozpocznij_glosowanie()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ile integer;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin rozpoczyna glosowanie';
  end if;

  delete from public.glosy_kapitan;

  with ruszone as (
    update public.teams set glosowanie = 'trwa'
    where glosowanie = 'nie_rozpoczete'
    returning id
  ), powiadomione as (
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    select 'push', 'team', id, 'Wybierzcie kapitana',
           'Głosowanie na kapitana drużyny jest otwarte.', '/app', 'kapitan', id::text
    from ruszone
    returning 1
  )
  select count(*)::integer into v_ile from powiadomione;

  return v_ile;
end;
$$;

revoke execute on function public.rozpocznij_glosowanie() from public, anon;
grant execute on function public.rozpocznij_glosowanie() to authenticated;

create function public.zamknij_glosowanie_teraz(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin zamyka glosowanie';
  end if;
  perform public.zamknij_glosowanie_druzyny(p_team);
end;
$$;

revoke execute on function public.zamknij_glosowanie_teraz(uuid) from public, anon;
grant execute on function public.zamknij_glosowanie_teraz(uuid) to authenticated;
