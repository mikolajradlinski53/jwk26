-- ============================================================
-- Sekta Wyjazdowa — kapitan raz nadaje drużynie nazwę i motto
-- ============================================================
--
-- Spec 2026-10-09-druzyny-kapitan-nazwa-design.md. Nazwa 1-30 znaków, motto
-- 0-60, nazwa unikalna bez względu na wielkość liter. Po nadaniu blokada;
-- admin może odblokować nieodpowiednią nazwę (wraca „Drużyna N”).

create function public.nadaj_nazwe_druzyny(p_nazwa text, p_motto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team    uuid;
  v_nadana  boolean;
  v_nazwa   text := btrim(coalesce(p_nazwa, ''));
  v_motto   text := nullif(btrim(coalesce(p_motto, '')), '');
begin
  select id, nazwa_nadana into v_team, v_nadana
  from public.teams where captain_id = auth.uid()
  limit 1
  for update;

  if v_team is null then
    raise exception 'Nazwe nadaje kapitan druzyny';
  end if;
  if v_nadana then
    raise exception 'NAZWA_JUZ_NADANA';
  end if;
  if length(v_nazwa) < 1 or length(v_nazwa) > 30 then
    raise exception 'NAZWA_DLUGOSC';
  end if;
  if v_motto is not null and length(v_motto) > 60 then
    raise exception 'MOTTO_DLUGOSC';
  end if;
  if exists (select 1 from public.teams where id <> v_team and lower(name) = lower(v_nazwa)) then
    raise exception 'NAZWA_ZAJETA';
  end if;

  update public.teams set name = v_nazwa, motto = v_motto, nazwa_nadana = true where id = v_team;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', v_team, 'Drużyna ma nazwę',
          'Od teraz jesteście: ' || v_nazwa, '/app', 'druzyna', v_team::text);
end;
$$;

revoke execute on function public.nadaj_nazwe_druzyny(text, text) from public, anon;
grant execute on function public.nadaj_nazwe_druzyny(text, text) to authenticated;

create function public.odblokuj_nazwe(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin odblokowuje nazwe';
  end if;
  update public.teams
  set nazwa_nadana = false,
      name = coalesce('Drużyna ' || numer, name),
      motto = null
  where id = p_team;
end;
$$;

revoke execute on function public.odblokuj_nazwe(uuid) from public, anon;
grant execute on function public.odblokuj_nazwe(uuid) to authenticated;
