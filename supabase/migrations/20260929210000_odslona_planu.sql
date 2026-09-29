-- ============================================================
-- Sekta Wyjazdowa — landing: zasłona planu wyjazdu
-- ============================================================
--
-- Zgłoszenie Mikołaja 2026-09-29: plan wyjazdu na landingu zakryty
-- licznikiem do 23 października, 14:00. Inaczej niż ośrodek i cena plan
-- NIE odsłania się razem z zapisami — ma czekać do dnia wyjazdu. Punkty
-- z `na_landingu` niezalogowany widzi dopiero po tej dacie (baza, nie strona).

insert into app_settings (key, value) values
  ('odslona_plan', '"2026-10-23T14:00:00+02:00"'::jsonb)
on conflict (key) do nothing;

create or replace function public.odsloniete(p_co text)
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
  if p_co not in ('osrodek', 'cena', 'zapisy', 'plan') then
    raise exception 'Nieznana odslona: %', p_co;
  end if;
  v_wlasna := public.data_odslony(p_co);
  -- Plan ma własny termin i nie zależy od zapisów.
  if p_co = 'plan' then
    return v_wlasna is null or now() >= v_wlasna;
  end if;
  v_zapisy := public.data_odslony('zapisy');
  return v_wlasna is null or now() >= v_wlasna
      or v_zapisy is null or now() >= v_zapisy;
end;
$$;

create or replace function public.odslony()
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
  from unnest(array['osrodek', 'cena', 'zapisy', 'plan']) as co;
$$;

drop policy if exists harmonogram_read_public on harmonogram;
create policy harmonogram_read_public on harmonogram
  for select to anon
  using (na_landingu and public.odsloniete('plan'));

drop policy if exists settings_read_public on app_settings;
create policy settings_read_public on app_settings
  for select to anon
  using (
    key in ('data_jwk', 'data_swiezakow', 'miejsce_nazwa', 'miejsce_adres',
            'regulamin_zatwierdzony',
            'przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota',
            'odslona_osrodek', 'odslona_cena', 'odslona_zapisy', 'odslona_plan',
            'social_instagram', 'social_facebook')
    and public.ustawienie_jawne(key)
  );
