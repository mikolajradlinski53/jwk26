-- Minimum puli kasyna na osobę (2026-10-24, „odblokuj im kasyno teraz”).
-- Pula z 25% punktów sprzed okna dawała w sobotę po 12:00 od 0 do 22 pkt na
-- osobę - zero albo dwa spiny. Teraz każdy dostaje co najmniej
-- `kasyno_minimum` pkt obrotu w oknie, ale nie więcej niż bieżące saldo
-- drużyny na głowę: nawet gdyby wszyscy przegrali całą pulę, drużyna nie
-- zejdzie pod zero. Wyłączenie: kasyno_minimum = 0.

insert into public.app_settings (key, value)
values ('kasyno_minimum', '100'::jsonb)
on conflict (key) do nothing;

create or replace function public.limit_kasyna_dla(p_user uuid)
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
  v_teraz   integer;
  v_ludzi   integer;
  v_procent numeric;
  v_minimum integer;
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
  v_minimum := coalesce((select (value #>> '{}')::integer from public.app_settings
                         where key = 'kasyno_minimum'), 0);

  select coalesce(sum(delta) filter (where created_at < public.poczatek_okna_kasyna()), 0)::integer,
         coalesce(sum(delta), 0)::integer
    into v_wynik, v_teraz
  from public.points_ledger
  where team_id = v_team;

  select count(*)::integer into v_ludzi
  from public.profiles
  where team_id = v_team and status = 'approved'::public.user_status;

  return greatest(
    floor(greatest(v_wynik, 0) * v_procent / 100.0 / greatest(v_ludzi, 1))::integer,
    least(v_minimum, floor(greatest(v_teraz, 0) / greatest(v_ludzi, 1)::numeric)::integer)
  );
end;
$$;

revoke execute on function public.limit_kasyna_dla(uuid) from public, anon, authenticated;
