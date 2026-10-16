-- Paczka 2026-10-15, punkty 12 i 7.
--
-- 1. Kadra - drużyna-widmo dla adminów (decyzja Mikołaja): admini są w niej,
--    każdy z nich działa jak kapitan (sklepik), wrzucają zdjęcia do bingo
--    i feedu, grają w kasynie. Drużyny nie widać w rankingu, w kronice
--    sklepiku, w głosowaniu ani w przydziale. Konta adminów dostają imię
--    i nazwisko jako nazwę (kruk, feed).
-- 2. Pula kasyna: zamiast stałych 300 pkt na dobę każdy może postawić w oknie
--    12 h (00-12 i 12-24 czasu polskiego) najwyżej 25% punktów drużyny
--    z początku okna podzielone przez liczbę jej członków. Liczy się suma
--    postawionych stawek (decyzja Mikołaja). Indywidualne saldo przestaje
--    blokować grę - gra się z puli drużyny.

-- ---------- 1. Kadra ----------

alter table public.teams add column ukryta boolean not null default false;

insert into public.teams (name, slug, color, ukryta, nazwa_nadana, glosowanie)
values ('Kadra', 'kadra', '#9c8b8e', true, true, 'zakonczone');

-- Imię i nazwisko z adresu: imie.nazwisko@... -> "Imie Nazwisko". Polskie
-- znaki poprawiamy ręcznie dla znanych kont, reszta zostaje bez ogonków.
update public.profiles p
set team_id = (select id from public.teams where ukryta),
    display_name = coalesce(
      p.display_name,
      case lower(p.email)
        when 'mikolaj.radlinski@samorzad.ue.wroc.pl' then 'Mikołaj Radliński'
        when 'radoslaw.wiethy@samorzad.ue.wroc.pl' then 'Radosław Wiethy'
        else initcap(replace(split_part(p.email, '@', 1), '.', ' '))
      end
    )
where p.role = 'admin' and p.team_id is null;

-- Nowy admin (z listy admini_wstepni) od razu trafia do Kadry z nazwą z maila.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  -- Porównanie po małych literach: Google potrafi zwrócić adres z wielką
  -- literą w imieniu, a wtedy zwykłe `=` przepuściłoby admina jako uczestnika
  -- i nikt by nie wiedział dlaczego.
  select exists (
    select 1 from public.admini_wstepni
    where lower(email) = lower(new.email)
  ) into v_admin;

  insert into public.profiles (id, email, role, status, team_id, display_name)
  values (
    new.id,
    new.email,
    case when v_admin then 'admin' else 'member' end::public.user_role,
    case when v_admin then 'approved' else 'pending' end::public.user_status,
    case when v_admin then (select id from public.teams where ukryta limit 1) end,
    case when v_admin then initcap(replace(split_part(new.email, '@', 1), '.', ' ')) end
  );
  return new;
end;
$$;

-- W Kadrze kapitanem jest każdy admin.
create or replace function public.is_captain(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team
      and (captain_id = auth.uid() or (ukryta and public.is_admin()))
  );
$$;

-- Ranking: kolumna na końcu (create or replace view nie przestawia kolumn),
-- filtr po stronie ekranów - sklepik Kadry dalej czyta stąd swoje saldo.
create or replace view public.team_scores with (security_invoker = on) as
  select t.id as team_id, t.name, t.slug, t.color,
         coalesce(sum(l.delta), 0)::int as score,
         t.motto,
         t.ukryta
  from public.teams t
  left join public.points_ledger l on l.team_id = t.id
  group by t.id, t.name, t.slug, t.color, t.motto, t.ukryta;

create or replace view public.kronika_sklepiku with (security_invoker = on) as
  select o.id, o.created_at, o.status, o.price_paid, o.note,
         i.name as item_name, i.kind as item_kind,
         t.name as team_name, t.color as team_color,
         c.name as target_team_name,
         p.display_name as ordered_by_name
  from public.shop_orders o
  join public.shop_items i on i.id = o.item_id
  join public.teams t on t.id = o.team_id
  left join public.teams c on c.id = o.target_team_id
  left join public.profiles p on p.id = o.ordered_by
  where not t.ukryta;

-- Klątwy zostają między prawdziwymi drużynami: Kadra nie odbiera nikomu
-- punktów zakupem i nie da się w nią celować.
create function public.kadra_bez_klatw()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.target_team_id is not null and exists (
    select 1 from public.teams
    where ukryta and id in (new.team_id, new.target_team_id)
  ) then
    raise exception 'Kadra nie bierze udzialu w klatwach';
  end if;
  return new;
end;
$$;

create trigger shop_orders_kadra_bez_klatw
  before insert on public.shop_orders
  for each row execute function public.kadra_bez_klatw();

-- Głosowanie na kapitana: Kadra nie głosuje i nie ma karty drużyny.
create or replace function public.stan_glosowania()
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
  select p.team_id into v_team
  from public.profiles p
  join public.teams t on t.id = p.team_id and not t.ukryta
  where p.id = auth.uid() and p.status = 'approved';
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

create or replace function public.postep_glosowania()
returns table(team_id uuid, glosow bigint, czlonkow integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin';
  end if;
  return query
    select t.id,
           coalesce((select sum(w.n) from public.glosy_waznych(t.id) w), 0)::bigint,
           public.czlonkow_druzyny(t.id)
    from public.teams t
    where not t.ukryta;
end;
$$;

-- Przydział: do Kadry trafiają wyłącznie admini, a „po równo” jej nie widzi.
create or replace function public.przydziel_druzyne(p_user uuid, p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stara  uuid;
  v_ukryta boolean;
  v_limit  integer := coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'druzyna_limit'), 9);
begin
  if not public.is_admin() then raise exception 'Tylko admin przydziela drużyny'; end if;

  select team_id into v_stara from public.profiles
  where id = p_user and status = 'approved'::public.user_status
  for update;
  if not found then raise exception 'Przydzielać można tylko przyjętych uczestników'; end if;
  if v_stara is not distinct from p_team then return; end if;

  if p_team is not null then
    select ukryta into v_ukryta from public.teams where id = p_team for update;
    if not found then raise exception 'Nie ma takiej drużyny'; end if;
    if v_ukryta and (select role from public.profiles where id = p_user) <> 'admin' then
      raise exception 'Do Kadry trafiaja tylko admini';
    end if;
    if (select count(*) from public.profiles
        where team_id = p_team and role <> 'admin' and status = 'approved'::public.user_status)
       >= v_limit
       and (select role from public.profiles where id = p_user) <> 'admin' then
      raise exception 'DRUZYNA_PELNA';
    end if;
  end if;

  update public.profiles set team_id = p_team where id = p_user;
  update public.teams set captain_id = null where id = v_stara and captain_id = p_user;
end;
$$;

create or replace function public.rozdziel_bez_druzyny()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'druzyna_limit'), 9);
  v_osoba uuid;
  v_team  uuid;
  v_ile   integer := 0;
  v_bez   integer := 0;
begin
  if not public.is_admin() then raise exception 'Tylko admin przydziela drużyny'; end if;
  perform 1 from public.teams for update;

  for v_osoba in
    select id from public.profiles
    where status = 'approved'::public.user_status and role <> 'admin' and team_id is null
    order by random()
  loop
    select t.id into v_team
    from public.teams t
    left join public.profiles p
      on p.team_id = t.id and p.role <> 'admin' and p.status = 'approved'::public.user_status
    where not t.ukryta
    group by t.id, t.numer
    having count(p.id) < v_limit
    order by count(p.id), t.numer
    limit 1;

    if v_team is null then
      v_bez := v_bez + 1;
    else
      update public.profiles set team_id = v_team where id = v_osoba;
      v_ile := v_ile + 1;
    end if;
  end loop;

  return jsonb_build_object('przydzielono', v_ile, 'bez_miejsca', v_bez);
end;
$$;

-- Przyjęcie zgłoszenia nie wrzuci uczestnika do Kadry.
create or replace function public.kadra_tylko_dla_adminow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.team_id is not null
     and new.team_id is distinct from old.team_id
     and new.role <> 'admin'
     and exists (select 1 from public.teams where id = new.team_id and ukryta) then
    raise exception 'Do Kadry trafiaja tylko admini';
  end if;
  return new;
end;
$$;

create trigger profiles_kadra_tylko_dla_adminow
  before update of team_id on public.profiles
  for each row execute function public.kadra_tylko_dla_adminow();

-- ---------- 2. Pula kasyna ----------

insert into public.app_settings (key, value) values ('kasyno_procent', '25')
on conflict (key) do nothing;

-- Początek bieżącego okna: północ albo południe czasu polskiego.
create function public.poczatek_okna_kasyna()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', now() at time zone 'Europe/Warsaw')
          + case when extract(hour from now() at time zone 'Europe/Warsaw') >= 12
                 then interval '12 hours' else interval '0 hours' end)
         at time zone 'Europe/Warsaw';
$$;

-- Pula osoby na bieżące okno: 25% punktów drużyny z chwili otwarcia okna
-- (wszystko w księdze sprzed jego początku), podzielone przez liczbę
-- przyjętych członków, w dół do pełnego punktu. Kadra nie ma punktów
-- z gry, więc gra ze stałej puli `casino_daily_stake_cap`.
create function public.limit_kasyna_dla(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team    uuid;
  v_ukryta  boolean;
  v_wynik   integer;
  v_ludzi   integer;
  v_procent numeric;
begin
  select p.team_id, t.ukryta into v_team, v_ukryta
  from public.profiles p
  left join public.teams t on t.id = p.team_id
  where p.id = p_user;

  if v_team is null then
    return 0;
  end if;

  if v_ukryta then
    return coalesce((select (value #>> '{}')::integer from public.app_settings
                     where key = 'casino_daily_stake_cap'), 300);
  end if;

  v_procent := coalesce((select (value #>> '{}')::numeric from public.app_settings
                         where key = 'kasyno_procent'), 25);

  select coalesce(sum(delta), 0)::integer into v_wynik
  from public.points_ledger
  where team_id = v_team and created_at < public.poczatek_okna_kasyna();

  select count(*)::integer into v_ludzi
  from public.profiles
  where team_id = v_team and status = 'approved'::public.user_status;

  return floor(greatest(v_wynik, 0) * v_procent / 100.0 / greatest(v_ludzi, 1))::integer;
end;
$$;

revoke execute on function public.limit_kasyna_dla(uuid) from public, anon, authenticated;

create or replace function public.obrot_w_oknie()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(stake), 0)::integer
  from public.game_sessions
  where user_id = auth.uid()
    and created_at >= public.poczatek_okna_kasyna();
$$;

-- Wszystko, czego ekran kasyna potrzebuje o puli, jednym wywołaniem.
create function public.pula_kasyna()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'limit', public.limit_kasyna_dla(auth.uid()),
    'obrot', (select coalesce(sum(stake), 0)::integer from public.game_sessions
              where user_id = auth.uid() and created_at >= public.poczatek_okna_kasyna()),
    'do', public.poczatek_okna_kasyna() + interval '12 hours'
  );
$$;

revoke execute on function public.pula_kasyna() from public, anon;
grant execute on function public.pula_kasyna() to authenticated;
revoke execute on function public.poczatek_okna_kasyna() from public, anon;
grant execute on function public.poczatek_okna_kasyna() to authenticated;

create or replace function public.bj_sprawdz_stawke(p_user uuid, p_stawka integer)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := public.limit_kasyna_dla(p_user);
  v_obrot integer;
begin
  select coalesce(sum(stake), 0)::integer into v_obrot
  from public.game_sessions
  where user_id = p_user and created_at >= public.poczatek_okna_kasyna();

  if v_obrot + p_stawka > v_limit then
    raise exception 'Limit obrotu wyczerpany: % z % punktow w tym oknie', v_obrot, v_limit;
  end if;
end;
$$;

revoke execute on function public.bj_sprawdz_stawke(uuid, integer) from public, anon, authenticated;

create or replace function public.zakrec_slotami()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_team    uuid;
  v_stawka  integer;
  v_limit   integer;
  v_obrot   integer;
  v_bebny   text[];
  v_wyplata integer;
  v_netto   integer;
  v_id      uuid;
begin
  -- SECURITY DEFINER omija RLS, więc uprawnienie sprawdzamy ręcznie. Bez tego
  -- zakręciłby każdy zalogowany, także ktoś ze statusem 'pending'.
  if not public.is_approved() then
    raise exception 'Tylko zaakceptowani uczestnicy moga grac';
  end if;

  -- Blokada wiersza gracza: dwa równoległe spiny nie przekroczą razem puli.
  select team_id into v_team
  from public.profiles where id = v_user for update;

  -- Księga wymaga team_id, więc gracz bez drużyny nie ma gdzie zapisać wyniku.
  if v_team is null then
    raise exception 'Nie nalezysz do zadnej druzyny';
  end if;

  select (value #>> '{}')::integer into v_stawka
  from public.app_settings where key = 'slots_stawka';

  v_limit := public.limit_kasyna_dla(v_user);
  v_obrot := public.obrot_w_oknie();

  -- Odbijamy spin, zamiast go przycinać: częściowy spin nie istnieje.
  if v_obrot + v_stawka > v_limit then
    raise exception 'Limit obrotu wyczerpany: % z % punktow w tym oknie',
      v_obrot, v_limit;
  end if;

  v_bebny   := public.losuj_bebny();
  v_wyplata := public.rozstrzygnij_bebny(v_bebny);
  v_netto   := v_wyplata - v_stawka;

  insert into public.game_sessions (user_id, game, stake, payout, state, status)
  values (v_user, 'sloty', v_stawka, v_wyplata,
          jsonb_build_object('bebny', to_jsonb(v_bebny)), 'settled')
  returning id into v_id;

  -- Jeden wpis netto, i tylko niezerowy (D4).
  if v_netto <> 0 then
    insert into public.points_ledger
      (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
    values
      (v_user, v_team, v_netto, 'kasyno',
       'Sloty: ' || array_to_string(v_bebny, ' '), 'slot_spin', v_id::text, v_user);
  end if;

  return jsonb_build_object(
    'bebny',   to_jsonb(v_bebny),
    'wyplata', v_wyplata,
    'netto',   v_netto,
    'obrot',   v_obrot + v_stawka,
    'limit',   v_limit
  );
end;
$$;

revoke execute on function public.zakrec_slotami() from anon, public;
grant  execute on function public.zakrec_slotami() to authenticated;
