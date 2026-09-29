-- ============================================================
-- Sekta Wyjazdowa — landing: zasłony (plan 16a)
-- ============================================================
--
-- Spec 2026-09-29-landing-finalizacja-design.md, sekcja 1. Ośrodek, cena
-- i zapisy odsłaniają się każde o swojej dacie; odsłona zapisów odsłania
-- wszystko. Decyduje baza, nie strona: polityki odczytu same odcinają
-- miejsce i dane przelewu, więc przed czasem nie da się ich wyciągnąć ani
-- z landingu, ani wprost przez API kluczem anon.

insert into app_settings (key, value) values
  ('odslona_osrodek',  '"2026-10-05T18:00:00+02:00"'::jsonb),
  ('odslona_cena',     '"2026-10-08T18:00:00+02:00"'::jsonb),
  ('odslona_zapisy',   '"2026-10-12T18:00:00+02:00"'::jsonb),
  ('social_instagram', '""'::jsonb),
  ('social_facebook',  '""'::jsonb)
on conflict (key) do nothing;

-- Pusta wartość = brak daty.
create function public.data_odslony(p_co text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(value #>> '{}', '')::timestamptz
  from public.app_settings where key = 'odslona_' || p_co;
$$;

-- Pusta data = odsłonięte (bezpieczne dla nowej bazy). Zapisy bez daty albo
-- po dacie odsłaniają wszystko — nikt nie akceptuje regulaminu z ukrytym
-- miejscem ani nie płaci bez widocznej ceny.
create function public.odsloniete(p_co text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_wlasna timestamptz;
  v_zapisy timestamptz;
begin
  if p_co not in ('osrodek', 'cena', 'zapisy') then
    raise exception 'Nieznana odslona: %', p_co;
  end if;
  v_wlasna := public.data_odslony(p_co);
  v_zapisy := public.data_odslony('zapisy');
  return v_wlasna is null or now() >= v_wlasna
      or v_zapisy is null or now() >= v_zapisy;
end;
$$;

-- Jeden odczyt dla strony: stan i data każdej odsłony.
create function public.odslony()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_object_agg(co, jsonb_build_object(
    'data', public.data_odslony(co),
    'odsloniete', public.odsloniete(co)
  ))
  from unnest(array['osrodek', 'cena', 'zapisy']) as co;
$$;

-- Czy klucz ustawień wolno dziś pokazać komuś, kto nie jest adminem.
create function public.ustawienie_jawne(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_key in ('miejsce_nazwa', 'miejsce_adres') then public.odsloniete('osrodek')
    when p_key in ('przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota') then public.odsloniete('cena')
    else true
  end;
$$;

revoke execute on function public.data_odslony(text) from public;
revoke execute on function public.odsloniete(text) from public;
revoke execute on function public.odslony() from public;
revoke execute on function public.ustawienie_jawne(text) from public;
grant execute on function public.data_odslony(text) to anon, authenticated;
grant execute on function public.odsloniete(text) to anon, authenticated;
grant execute on function public.odslony() to anon, authenticated;
grant execute on function public.ustawienie_jawne(text) to anon, authenticated;

-- ---------- Odczyt ustawień ----------
drop policy if exists settings_read_public on app_settings;
create policy settings_read_public on app_settings
  for select to anon
  using (
    key in ('data_jwk', 'data_swiezakow', 'miejsce_nazwa', 'miejsce_adres',
            'regulamin_zatwierdzony',
            'przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota',
            'odslona_osrodek', 'odslona_cena', 'odslona_zapisy',
            'social_instagram', 'social_facebook')
    and public.ustawienie_jawne(key)
  );

-- Zalogowany nie-admin czyta jak dotąd wszystko, poza zakrytymi kluczami.
drop policy if exists settings_read on app_settings;
create policy settings_read on app_settings
  for select to authenticated
  using (public.is_admin() or public.ustawienie_jawne(key));

-- ---------- Adresy social ----------
-- Pusty albo profil w swoim serwisie — link z landingu nie wyprowadzi
-- nikogo na obcą stronę, nawet po literówce w panelu.
alter table app_settings
  add constraint app_settings_social_check check (
    (key <> 'social_instagram'
      or coalesce(value #>> '{}', '') = ''
      or (value #>> '{}') ~ '^https://www\.instagram\.com/[A-Za-z0-9._/?=&-]+$')
    and
    (key <> 'social_facebook'
      or coalesce(value #>> '{}', '') = ''
      or (value #>> '{}') ~ '^https://www\.facebook\.com/[A-Za-z0-9._/?=&-]+$')
  );
