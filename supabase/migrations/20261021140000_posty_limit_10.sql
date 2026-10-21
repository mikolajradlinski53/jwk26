-- Limit postów w feedzie: 10 na godzinę na osobę zamiast 30 (Mikołaj
-- 2026-10-21: „żeby nie spamowali”).
create or replace function public.posty_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id is null and (
    select count(*) from public.bingo_submissions
    where user_id = new.user_id and task_id is null and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'POSTY_LIMIT';
  end if;
  return new;
end;
$$;

revoke execute on function public.posty_limit() from public, anon, authenticated;
