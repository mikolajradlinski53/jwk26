-- ============================================================
-- Sekta Wyjazdowa — poprawki z finałowego review planu 17 (drużyny)
-- ============================================================
--
-- Trzy niezależne poprawki znalezione przy przeglądzie całej gałęzi:
--
-- 1. nadaj_nazwe_druzyny(): samo „captain_id = auth.uid()” nie wystarcza za
--    dowód, że wołający naprawdę prowadzi tę drużynę teraz. Kapitan
--    przeniesiony później do innej drużyny albo ustawiony ręcznie w trakcie
--    głosowania (np. przez admina, zamiast przez zamknij_glosowanie_druzyny)
--    mógłby nadać nazwę drużynie, której już nie jest członkiem, albo zanim
--    głosowanie się skończyło. Warunek rozszerzony: wołający musi być
--    zatwierdzonym członkiem TEJ drużyny (profiles.team_id), jej kapitanem
--    (teams.captain_id) i głosowanie musi być zakończone (teams.glosowanie).
--
-- 2. Ta sama funkcja: nazwy-placeholdery „Drużyna N” / „druzyna N” (z
--    akcentem i bez) są zarezerwowane dla stanu początkowego. Bez tej
--    blokady kapitan mógłby ręcznie nadać drużynie nazwę „Drużyna 1” -
--    unikalny indeks na lower(name) później odrzuciłby admina, który chce
--    odblokować prawdziwą „Drużynę 1” (odblokuj_nazwe ustawia z powrotem
--    „Drużyna ” || numer, co zderzyłoby się z zajętą już nazwą).
--
-- 3. sprzataj_zabawy() (zdefiniowane w 20260929190000_retencja_zabaw.sql,
--    nigdzie później nie przedefiniowane): głosy na kapitana to tajna treść
--    z zabawy jak reszta treści kasowanych po terminie retencji - dochodzi
--    `delete from public.glosy_kapitan where true` (where true: pg-safeupdate
--    odrzuca DELETE bez WHERE). Grants/revokes zostają jak w oryginale.

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
  from public.teams
  where captain_id = auth.uid()
    and id = (select team_id from public.profiles where id = auth.uid() and status = 'approved')
    and glosowanie = 'zakonczone'
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
  -- Zarezerwowane: „Drużyna 1”, „druzyna 12”... (z akcentem i bez, bez
  -- względu na wielkość liter i odstępy przed cyfrą).
  if lower(v_nazwa) ~ '^(drużyna|druzyna)\s*[0-9]+$' then
    raise exception 'NAZWA_ZAJETA';
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

-- ---------- Retencja: głosy na kapitana to też treść z zabawy ----------
create or replace function public.sprzataj_zabawy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_termin date;
  v_pliki  integer := 0;
begin
  select (value #>> '{}')::date into v_termin
  from public.app_settings where key = 'data_retencji_zabaw';

  if v_termin is null or current_date <= v_termin then
    return jsonb_build_object('wykonane', false);
  end if;

  v_pliki := public.zlec_usuniecie_plikow('bingo') + public.zlec_usuniecie_plikow('gossip');

  -- `where true`: część konfiguracji odrzuca DELETE bez WHERE.
  delete from public.feed_likes where true;
  delete from public.feed_comments where true;
  delete from public.bingo_submissions where true;
  delete from public.gossip_categories where true;   -- głosy kaskadą
  delete from public.game_sessions where true;
  delete from public.kruk_gry where true;
  delete from public.active_effects where true;
  delete from public.shop_orders where true;
  delete from public.points_ledger where true;
  delete from public.powiadomienia where true;
  delete from public.glosy_kapitan where true;

  return jsonb_build_object('wykonane', true, 'pliki_zlecone', v_pliki);
end;
$$;

revoke execute on function public.sprzataj_zabawy() from public, anon, authenticated;
grant  execute on function public.sprzataj_zabawy() to service_role;
