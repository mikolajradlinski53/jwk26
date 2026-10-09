-- ============================================================
-- Sekta Wyjazdowa — poprawka: DELETE bez WHERE odpada w Supabase
-- ============================================================
--
-- `pg-safeupdate` blokuje DELETE/UPDATE bez klauzuli WHERE, więc
-- `delete from public.glosy_kapitan;` w 20261009120000 wywalało
-- rozpocznij_glosowanie() kodem 21000 ("DELETE requires a WHERE clause").
-- Poprawka kwalifikuje usunięcie, tak jak robi to resetuj() w testach.

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

  delete from public.glosy_kapitan where voter_id is not null;

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
