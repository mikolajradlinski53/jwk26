-- ============================================================
-- Sekta Wyjazdowa — SMS-y przez SMSAPI (zaplecze)
-- ============================================================
--
-- Ta sama droga co push (plan 11): wiersz w `powiadomienia` z kanałem
-- `sms`, wyzwalacz przez pg_net woła trasę /api/sms, trasa pobiera paczkę
-- funkcją pobierz_sms i wysyła przez SMSAPI. Dopóki `sms_url` jest pusty,
-- nic nigdzie nie dzwoni — tak zostaje na bazie testowej, a na produkcji
-- do zakupu usługi. Po zakupie: token w Vercelu + adres trasy w sekretach
-- (docs/sms.md).
--
-- SMS kosztuje, więc wysyła go wyłącznie admin, świadomie, przy ogłoszeniu.
-- Adresatami są tylko osoby ze zgodą na SMS-y i numerem w profilu.

insert into sekrety (klucz, wartosc) values
  ('sms',     replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('sms_url', '')
on conflict (klucz) do nothing;

-- ---------- Dzwonek do trasy wysyłki ----------
create function public.pchnij_sms()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_sekret text;
begin
  select wartosc into v_url from public.sekrety where klucz = 'sms_url';
  if coalesce(v_url, '') = '' then
    return;
  end if;
  select wartosc into v_sekret from public.sekrety where klucz = 'sms';

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sms-sekret', v_sekret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.pchnij_sms() from public, anon, authenticated;

create or replace function public.po_nowym_powiadomieniu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kanal = 'push' then
    perform public.pchnij_push();
  elsif new.kanal = 'sms' then
    perform public.pchnij_sms();
  end if;
  return null;
end;
$$;

-- Ponawianie jak przy push, ale tylko przez godzinę: SMS o zbiórce sprzed
-- trzech godzin wysłany po naprawie konfiguracji to wyrzucone pieniądze
-- i wprowadzanie ludzi w błąd.
select cron.schedule(
  'ponow-sms',
  '* * * * *',
  $$select public.pchnij_sms()
    where exists (
      select 1 from public.powiadomienia
      where kanal = 'sms' and wyslane_at is null and proby < 5
        and created_at < now() - interval '30 seconds'
        and created_at > now() - interval '1 hour'
    )$$
);

-- ---------- Paczka do wysłania ----------
-- Numery adresatów ze zgodą; format zostawiamy trasie (normalizacja do 48…).
create function public.pobierz_sms(p_sekret text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ok    boolean;
  v_wynik jsonb;
begin
  select p_sekret is not null and p_sekret = wartosc into v_ok
  from public.sekrety where klucz = 'sms';
  if v_ok is not true then
    raise exception 'Brak dostepu';
  end if;

  with paczka as (
    select p.id
    from public.powiadomienia p
    where p.kanal = 'sms' and p.wyslane_at is null and p.proby < 5
      and p.created_at > now() - interval '1 hour'
    order by p.id
    limit 20
    for update skip locked
  ), zliczone as (
    update public.powiadomienia p
    set proby = p.proby + 1
    from paczka
    where p.id = paczka.id
    returning p.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',    z.id,
      'tytul', z.tytul,
      'tresc', z.body,
      'numery', coalesce((
        select jsonb_agg(distinct pr.phone)
        from public.profiles pr
        where pr.id in (select public.adresaci_powiadomienia(z.adresat, z.adresat_id, z.pula))
          and pr.sms_consent
          and nullif(btrim(pr.phone), '') is not null
      ), '[]'::jsonb)
    ) order by z.id), '[]'::jsonb)
  into v_wynik
  from zliczone z;

  return v_wynik;
end;
$$;

create function public.oznacz_sms(p_sekret text, p_id bigint, p_wyslane integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select p_sekret is not null and p_sekret = wartosc into v_ok
  from public.sekrety where klucz = 'sms';
  if v_ok is not true then
    raise exception 'Brak dostepu';
  end if;

  update public.powiadomienia
  set wyslane_at = now(), wyslane_do = greatest(coalesce(p_wyslane, 0), 0)
  where id = p_id and kanal = 'sms';
end;
$$;

revoke execute on function public.pobierz_sms(text) from public, anon, authenticated;
grant  execute on function public.pobierz_sms(text) to anon, service_role;
revoke execute on function public.oznacz_sms(text, bigint, integer) from public, anon, authenticated;
grant  execute on function public.oznacz_sms(text, bigint, integer) to anon, service_role;

-- ---------- Ogłoszenie z opcją SMS ----------
-- Nowy parametr z wartością domyślną; stara wersja znika, bo dwie funkcje
-- o tej samej nazwie PostgREST rozstrzyga niejednoznacznie.
drop function if exists public.wyslij_ogloszenie(text, text, text, uuid, text);

create function public.wyslij_ogloszenie(
  p_tytul   text,
  p_tresc   text,
  p_adresat text,
  p_druzyna uuid default null,
  p_pula    text default null,
  p_sms     boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze wysylac ogloszenia';
  end if;

  if nullif(btrim(p_tytul), '') is null or length(btrim(p_tytul)) > 80 then
    raise exception 'Tytul: od 1 do 80 znakow';
  end if;
  if nullif(btrim(p_tresc), '') is null or length(btrim(p_tresc)) > 300 then
    raise exception 'Tresc: od 1 do 300 znakow';
  end if;

  if p_adresat = 'team' then
    if p_druzyna is null or not exists (select 1 from public.teams where id = p_druzyna) then
      raise exception 'Wybierz druzyne';
    end if;
  elsif p_adresat = 'pula' then
    if p_pula is null or not exists (select 1 from public.pule where klucz = p_pula) then
      raise exception 'Wybierz pule';
    end if;
  elsif p_adresat is distinct from 'all' then
    raise exception 'Nieznany adresat';
  end if;

  insert into public.powiadomienia (kanal, adresat, adresat_id, pula, tytul, body, link, ref_type)
  values (
    'push', p_adresat,
    case when p_adresat = 'team' then p_druzyna end,
    case when p_adresat = 'pula' then p_pula end,
    btrim(p_tytul), btrim(p_tresc), '/app', 'ogloszenie'
  )
  returning id into v_id;

  if coalesce(p_sms, false) then
    insert into public.powiadomienia (kanal, adresat, adresat_id, pula, tytul, body, link, ref_type, ref_id)
    values (
      'sms', p_adresat,
      case when p_adresat = 'team' then p_druzyna end,
      case when p_adresat = 'pula' then p_pula end,
      btrim(p_tytul), btrim(p_tresc), '/app', 'ogloszenie', v_id::text
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.wyslij_ogloszenie(text, text, text, uuid, text, boolean) from public, anon;
grant  execute on function public.wyslij_ogloszenie(text, text, text, uuid, text, boolean) to authenticated;
