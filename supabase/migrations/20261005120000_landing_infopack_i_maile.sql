-- ============================================================
-- Sekta Wyjazdowa — poprawki landingu z 2026-10-05 i maile o zgłoszeniach
-- ============================================================
--
-- Zgłoszenie Mikołaja 2026-10-05:
-- - cena odsłania się 11.10 o 12:00, zapisy 12.10 o 12:00;
-- - harmonogram (dawny „plan wyjazdu”) w czwartek przed wyjazdem, 22.10;
-- - nowa zasłona „Infopack” do 22.10, 12:00 — jak plan, z własnym terminem,
--   niezależnym od zapisów;
-- - dane do przelewu: odbiorca, konto i numer telefonu (nowy klucz);
-- - organizatorzy dostają maila przy każdym zgłoszeniu i osobnego, gdy tura
--   się zapełni.

-- ---------- Daty odsłon ----------
update app_settings set value = '"2026-10-11T12:00:00+02:00"'::jsonb where key = 'odslona_cena';
update app_settings set value = '"2026-10-12T12:00:00+02:00"'::jsonb where key = 'odslona_zapisy';
update app_settings set value = '"2026-10-22T12:00:00+02:00"'::jsonb where key = 'odslona_plan';

insert into app_settings (key, value) values
  ('odslona_infopack', '"2026-10-22T12:00:00+02:00"'::jsonb),
  ('przelew_telefon',  '""'::jsonb)
on conflict (key) do nothing;

-- ---------- Dane do przelewu ----------
update app_settings set value = '"Magdalena Skoczylas"'::jsonb where key = 'przelew_odbiorca';
update app_settings set value = '"56124031581111001090026729"'::jsonb where key = 'przelew_numer_konta';
update app_settings set value = '"517 812 080"'::jsonb where key = 'przelew_telefon';

-- ---------- Odsłony: infopack z własnym terminem ----------
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
  if p_co not in ('osrodek', 'cena', 'zapisy', 'plan', 'infopack') then
    raise exception 'Nieznana odslona: %', p_co;
  end if;
  v_wlasna := public.data_odslony(p_co);
  -- Plan i infopack mają własny termin i nie zależą od zapisów.
  if p_co in ('plan', 'infopack') then
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
  from unnest(array['osrodek', 'cena', 'zapisy', 'plan', 'infopack']) as co;
$$;

-- Telefon do przelewu zakryty razem z resztą danych przelewu.
create or replace function public.ustawienie_jawne(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_key in ('miejsce_nazwa', 'miejsce_adres') then public.odsloniete('osrodek')
    when p_key in ('przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota', 'przelew_telefon')
      then public.odsloniete('cena')
    else true
  end;
$$;

drop policy if exists settings_read_public on app_settings;
create policy settings_read_public on app_settings
  for select to anon
  using (
    key in ('data_jwk', 'data_swiezakow', 'miejsce_nazwa', 'miejsce_adres',
            'regulamin_zatwierdzony',
            'przelew_numer_konta', 'przelew_odbiorca', 'przelew_kwota', 'przelew_telefon',
            'odslona_osrodek', 'odslona_cena', 'odslona_zapisy', 'odslona_plan', 'odslona_infopack',
            'social_instagram', 'social_facebook')
    and public.ustawienie_jawne(key)
  );

-- ============================================================
-- Maile do organizatorów o zgłoszeniach
-- ============================================================
--
-- Wysyłka wprost z bazy do API Resend (ta sama domena co kody logowania,
-- nadawca no-reply@jwk26.pl). Klucz API i adresy odbiorców leżą w `sekrety`;
-- dopóki któreś jest puste, nic nigdzie nie wychodzi — tak zostaje na bazie
-- testowej. Ustawienie na produkcji:
--   update sekrety set wartosc = 're_…' where klucz = 'resend_klucz';
--   update sekrety set wartosc = 'a@x.pl, b@y.pl' where klucz = 'maile_zgloszen';
--
-- Każdy mail trafia też do `maile_zgloszen_log` (bez dostępu z API poza
-- kluczem serwisowym): jest po czym sprawdzić, co poszło, a testy mają co
-- czytać. Wiersze starsze niż 30 dni znikają przy kolejnym mailu.

insert into sekrety (klucz, wartosc) values
  ('resend_klucz',   ''),
  ('maile_zgloszen', '')
on conflict (klucz) do nothing;

create table maile_zgloszen_log (
  id         bigint generated always as identity primary key,
  rodzaj     text not null check (rodzaj in ('zgloszenie', 'pula_pelna')),
  pula       text references pule(klucz) on delete set null,
  temat      text not null,
  tresc      text not null,
  wyslany    boolean not null,
  created_at timestamptz not null default now()
);

alter table maile_zgloszen_log enable row level security;
revoke all on maile_zgloszen_log from anon, authenticated;

create function public.wyslij_mail_organizatorom(p_rodzaj text, p_pula text, p_temat text, p_tresc text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_klucz text;
  v_do    text[];
begin
  select nullif(btrim(wartosc), '') into v_klucz from public.sekrety where klucz = 'resend_klucz';
  select array_agg(a) into v_do
  from (
    select btrim(x) as a
    from public.sekrety s, unnest(string_to_array(s.wartosc, ',')) as x
    where s.klucz = 'maile_zgloszen'
  ) adresy
  where a <> '';

  delete from public.maile_zgloszen_log where created_at < now() - interval '30 days';

  insert into public.maile_zgloszen_log (rodzaj, pula, temat, tresc, wyslany)
  values (p_rodzaj, p_pula, p_temat, p_tresc, v_klucz is not null and v_do is not null);

  if v_klucz is null or v_do is null then
    return;
  end if;

  -- pg_net kolejkuje żądanie i wysyła je po zatwierdzeniu transakcji, więc
  -- odrzucone zgłoszenie (wyjątek w zloz_zgloszenie) nie wyśle maila.
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object(
      'from', 'JWK26 <no-reply@jwk26.pl>',
      'to', to_jsonb(v_do),
      'subject', p_temat,
      'text', p_tresc
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_klucz
    ),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.wyslij_mail_organizatorom(text, text, text, text)
  from public, anon, authenticated;

create function public.po_zgloszeniu_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pula   public.pule%rowtype;
  v_zajete integer;
  v_lista  text;
begin
  if new.pula is null then
    return null;
  end if;

  -- Mail to dodatek: żaden błąd wysyłki nie może wycofać zgłoszenia.
  begin
    select * into v_pula from public.pule where klucz = new.pula;

    select count(*)::integer into v_zajete
    from public.registrations
    where pula = new.pula
      and not rezerwa
      and status in ('pending'::public.user_status, 'approved'::public.user_status);

    v_lista := case
      when new.rezerwa then format('lista rezerwowa (numer %s)', new.kolejnosc_rezerwy)
      else format('lista główna (zajęte %s z %s miejsc)', v_zajete, v_pula.miejsca)
    end;

    perform public.wyslij_mail_organizatorom(
      'zgloszenie',
      new.pula,
      format('JWK26: nowe zgłoszenie - %s', v_pula.nazwa),
      format(
        E'Nowe zgłoszenie w turze %s.\n\nOsoba: %s\nLista: %s\n\nSprawdź i zdecyduj w panelu: https://www.jwk26.pl/app/admin/rejestracje',
        v_pula.nazwa, coalesce(new.full_name, '(bez nazwiska)'), v_lista
      )
    );

    -- Zgłoszenie, które zajęło ostatnie miejsce. Równość, nie „>=”: pula
    -- jest zablokowana w zloz_zgloszenie (for update), więc dokładnie jedno
    -- zgłoszenie ją domyka; kolejne idą już na rezerwę.
    if not new.rezerwa and v_pula.miejsca > 0 and v_zajete = v_pula.miejsca then
      perform public.wyslij_mail_organizatorom(
        'pula_pelna',
        new.pula,
        format('JWK26: tura %s zapełniona', v_pula.nazwa),
        format(
          E'Tura %s ma komplet: %s z %s miejsc.\n\nKolejne osoby zapisują się na listę rezerwową bez wpłaty.',
          v_pula.nazwa, v_zajete, v_pula.miejsca
        )
      );
    end if;
  exception when others then
    raise warning 'Mail o zgłoszeniu nie wyszedł: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke execute on function public.po_zgloszeniu_mail() from public, anon, authenticated;

create trigger registrations_mail
  after insert on registrations
  for each row execute function public.po_zgloszeniu_mail();
