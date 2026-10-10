-- ============================================================
-- Sekta Wyjazdowa — postęp głosowania dla panelu admina
-- ============================================================
--
-- Tabela głosów jest zamknięta dla wszystkich ról aplikacji, także admina -
-- panel dostaje tylko liczby (ile osób zagłosowało, ile jest w drużynie),
-- nigdy kto na kogo.

create function public.postep_glosowania()
returns table (team_id uuid, glosow bigint, czlonkow integer)
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
    from public.teams t;
end;
$$;

revoke execute on function public.postep_glosowania() from public, anon;
grant execute on function public.postep_glosowania() to authenticated;
