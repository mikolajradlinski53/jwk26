-- ============================================================
-- Sekta Wyjazdowa — nazwa drużyny pilnowana indeksem, nie tylko funkcją
-- ============================================================
--
-- Poprzednia wersja nadaj_nazwe_druzyny() sprawdzała unikalność nazwy samym
-- selectem przed update - dwóch kapitanów nadających tę samą nazwę w tej
-- samej chwili mogło oba razy przejść walidację (TOCTOU). Unikalny indeks na
-- lower(name) daje twardą gwarancję na poziomie bazy; funkcja łapie wyjątek
-- unique_violation i zamienia go na ten sam komunikat NAZWA_ZAJETA, więc
-- interfejs nie musi rozróżniać dwóch źródeł tego samego błędu.

create unique index teams_nazwa_unikalna on teams (lower(name));

create or replace function public.nadaj_nazwe_druzyny(p_nazwa text, p_motto text)
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

  begin
    update public.teams set name = v_nazwa, motto = v_motto, nazwa_nadana = true where id = v_team;
  exception
    when unique_violation then
      raise exception 'NAZWA_ZAJETA';
  end;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', v_team, 'Drużyna ma nazwę',
          'Od teraz jesteście: ' || v_nazwa, '/app', 'druzyna', v_team::text);
end;
$$;

revoke execute on function public.nadaj_nazwe_druzyny(text, text) from public, anon;
grant execute on function public.nadaj_nazwe_druzyny(text, text) to authenticated;
