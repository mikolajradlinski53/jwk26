-- ============================================================
-- Sekta Wyjazdowa — retencja treści z zabaw, plików i kont
-- ============================================================
--
-- Polityka prywatności (2026-09-29) obiecuje:
--   * treści z zabaw (zdjęcia, komentarze, nominacje, gry, punkty,
--     zamówienia) — do 31 stycznia 2027 r.;
--   * dane zgłoszenia z potwierdzeniem przelewu i konto — do 31 grudnia 2027 r.
-- Dotąd sprzątanie czyściło tylko pola zgłoszeń: pliki przelewów i konta
-- zostawały bez końca, a treści z zabaw nie miały terminu wcale.
--
-- Pliki kasujemy przez API Storage, nie SQL-em — wyzwalacz
-- storage.protect_objects_delete i tak odrzuca DELETE na storage.objects,
-- a skasowany wiersz zostawiałby plik w magazynie. Wywołanie idzie przez
-- pg_net z kluczem serwisowym trzymanym w Vault (sekret `klucz_serwisowy`),
-- adres projektu w sekrety.storage_url. Bez któregokolwiek z nich pliki
-- zostają, a reszta sprzątania działa normalnie.

insert into app_settings (key, value) values
  ('data_retencji_zabaw', '"2027-01-31"'::jsonb)
on conflict (key) do nothing;

insert into sekrety (klucz, wartosc) values ('storage_url', '')
on conflict (klucz) do nothing;

-- ---------- Pliki ----------
-- Paczki po 1000 nazw (limit endpointu). pg_net wysyła żądania po
-- zatwierdzeniu transakcji; plik, którego usunięcie by nie przeszło, zostanie
-- zlecony ponownie następnej nocy — zlecenie jest idempotentne.
create function public.zlec_usuniecie_plikow(p_bucket text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_klucz  text;
  v_paczka jsonb;
  v_razem  integer := 0;
begin
  select wartosc into v_url from public.sekrety where klucz = 'storage_url';
  select decrypted_secret into v_klucz from vault.decrypted_secrets where name = 'klucz_serwisowy';
  if coalesce(v_url, '') = '' or v_klucz is null then
    return 0;
  end if;

  loop
    select jsonb_agg(x.name) into v_paczka
    from (
      select o.name from storage.objects o
      where o.bucket_id = p_bucket
      order by o.name
      limit 1000 offset v_razem
    ) x;
    exit when v_paczka is null;

    perform net.http_delete(
      url := v_url || '/storage/v1/object/' || p_bucket,
      body := jsonb_build_object('prefixes', v_paczka),
      headers := jsonb_build_object(
        'apikey', v_klucz,
        'Authorization', 'Bearer ' || v_klucz,
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds := 30000
    );
    v_razem := v_razem + jsonb_array_length(v_paczka);
  end loop;

  return v_razem;
end;
$$;

revoke execute on function public.zlec_usuniecie_plikow(text) from public, anon, authenticated;
grant  execute on function public.zlec_usuniecie_plikow(text) to service_role;

-- ---------- Treści z zabaw ----------
-- Po terminie znika wszystko, co powstało w zabawach. Zostają rzeczy bez
-- danych osobowych: drużyny, zadania bingo, półka sklepiku, harmonogram.
create function public.sprzataj_zabawy()
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

  return jsonb_build_object('wykonane', true, 'pliki_zlecone', v_pliki);
end;
$$;

revoke execute on function public.sprzataj_zabawy() from public, anon, authenticated;
grant  execute on function public.sprzataj_zabawy() to service_role;

-- ---------- Zgłoszenia: dochodzą pliki przelewów i konta ----------
-- Treść jak w 20260927120400, plus dwa kroki po terminie retencji zgłoszeń.
-- Konta kasujemy tylko te założone przed terminem i nie adminów: ktoś, kto
-- zaloguje się później (np. przy kolejnym wyjeździe na tej samej bazie),
-- nie zniknie następnej nocy. Profil, zgłoszenia i reszta idą kaskadą.
create or replace function public.sprzataj_dane()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_koniec     date;
  v_retencja   date;
  v_wrazliwe   integer := 0;
  v_zgloszenia integer := 0;
  v_konta      integer := 0;
  v_pliki      integer := 0;
begin
  select (value #>> '{}')::date into v_koniec
  from public.app_settings where key = 'data_konca_jwk';

  select (value #>> '{}')::date into v_retencja
  from public.app_settings where key = 'data_retencji_zgloszen';

  if v_koniec is not null and current_date >= v_koniec + 14 then
    delete from public.dane_wrazliwe where registration_id is not null;
    get diagnostics v_wrazliwe = row_count;

    update public.registrations set diet_notes = null where diet_notes is not null;
  end if;

  if v_retencja is not null and current_date > v_retencja then
    update public.registrations
    set imie = null, nazwisko = null, nr_indeksu = null, data_urodzenia = null,
        phone = null, full_name = '(usunieto)', ksywka = null,
        piosenka = null, uwagi = null, ocr_text = null
    where full_name <> '(usunieto)';
    get diagnostics v_zgloszenia = row_count;

    update public.profiles p
    set phone = null
    where exists (
      select 1 from public.registrations r
      where r.user_id = p.id and r.full_name = '(usunieto)'
    );

    v_pliki := public.zlec_usuniecie_plikow('proofs');

    delete from auth.users u
    where u.created_at::date <= v_retencja
      and not exists (select 1 from public.profiles p where p.id = u.id and p.role = 'admin');
    get diagnostics v_konta = row_count;
  end if;

  return jsonb_build_object(
    'dane_wrazliwe', v_wrazliwe,
    'zgloszenia', v_zgloszenia,
    'konta', v_konta,
    'pliki_zlecone', v_pliki
  );
end;
$$;

select cron.schedule('sprzataj-zabawy', '27 3 * * *', 'select public.sprzataj_zabawy()');
