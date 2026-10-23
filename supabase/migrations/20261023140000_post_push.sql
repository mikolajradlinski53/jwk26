-- Push do wszystkich przy nowym poście w feedzie (Mikołaj 2026-10-23).
-- Tylko swobodne posty (task_id NULL) - zaliczone bingo ma własny push do drużyny.
-- Tytuł z nazwą autora, treść = podpis albo „wrzucił(a) zdjęcie/film”.
create or replace function public.post_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kto text;
begin
  if new.task_id is not null then
    return new;
  end if;
  select coalesce(display_name, 'Ktoś') into v_kto from public.profiles where id = new.user_id;
  insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
  values ('push', 'all', 'Nowy post: ' || v_kto,
          coalesce(nullif(btrim(new.caption), ''),
                   case when new.photo_path ~* '\.(mp4|mov|webm)$' then 'Wrzucił(a) film' else 'Wrzucił(a) zdjęcie' end),
          '/app/feed', 'post', new.id::text);
  return new;
end;
$$;

revoke execute on function public.post_push() from public, anon, authenticated;

create trigger post_push
  after insert on public.bingo_submissions
  for each row execute function public.post_push();
