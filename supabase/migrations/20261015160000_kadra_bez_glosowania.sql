-- Kadra (ukryta drużyna adminów) nigdy nie wchodzi w głosowanie na kapitana -
-- nawet gdyby jej etap ktoś cofnął na 'nie_rozpoczete'. W Kadrze kapitanem
-- jest każdy admin (is_captain), więc głosowanie nie ma tam sensu.

create or replace function public.rozpocznij_glosowanie()
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

  delete from public.glosy_kapitan
  where team_id in (select id from public.teams where glosowanie = 'nie_rozpoczete' and not ukryta);

  with ruszone as (
    update public.teams set glosowanie = 'trwa'
    where glosowanie = 'nie_rozpoczete' and not ukryta
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

update public.teams set glosowanie = 'zakonczone', nazwa_nadana = true where ukryta;
