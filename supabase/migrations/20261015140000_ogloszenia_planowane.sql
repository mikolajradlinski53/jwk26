-- Ogłoszenia planowane na godzinę (paczka 2026-10-15, punkt 8).
--
-- Admin ustawia treść, adresata i chwilę wysyłki. pg_cron co minutę wkłada
-- dojrzałe ogłoszenia do skrzynki `powiadomienia` - dalej idą tą samą drogą
-- co ogłoszenie wysłane od ręki (push, opcjonalnie SMS). Do chwili wysyłki
-- ogłoszenie można anulować.

create table public.ogloszenia_planowane (
  id          bigint generated always as identity primary key,
  tytul       text not null,
  tresc       text not null,
  adresat     text not null check (adresat in ('all', 'team', 'pula')),
  druzyna     uuid references public.teams (id) on delete cascade,
  pula        text,
  sms         boolean not null default false,
  kiedy       timestamptz not null,
  utworzyl    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  wyslane_at  timestamptz,
  anulowane_at timestamptz,
  powiadomienie_id bigint
);

create index ogloszenia_planowane_czekajace on public.ogloszenia_planowane (kiedy)
  where wyslane_at is null and anulowane_at is null;

alter table public.ogloszenia_planowane enable row level security;

create policy ogloszenia_planowane_admin_read on public.ogloszenia_planowane
  for select to authenticated using (public.is_admin());

-- Wspólne sprawdzenie i wstawienie - bez sprawdzania roli, bo woła je też
-- cron (bez auth.uid()). Dla ludzi dostępne tylko przez funkcje niżej.
create function public.nadaj_ogloszenie(
  p_tytul   text,
  p_tresc   text,
  p_adresat text,
  p_druzyna uuid,
  p_pula    text,
  p_sms     boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
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

revoke execute on function public.nadaj_ogloszenie(text, text, text, uuid, text, boolean) from public, anon, authenticated;

create or replace function public.wyslij_ogloszenie(
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
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze wysylac ogloszenia';
  end if;
  return public.nadaj_ogloszenie(p_tytul, p_tresc, p_adresat, p_druzyna, p_pula, p_sms);
end;
$$;

create function public.zaplanuj_ogloszenie(
  p_tytul   text,
  p_tresc   text,
  p_adresat text,
  p_kiedy   timestamptz,
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
  if p_kiedy is null or p_kiedy <= now() then
    raise exception 'Godzina wysylki juz minela';
  end if;
  if p_kiedy > now() + interval '60 days' then
    raise exception 'Najdalej 60 dni naprzod';
  end if;

  -- Te same warunki co przy wysyłce od ręki, sprawdzone już teraz - błąd ma
  -- wyjść przy planowaniu, a nie o trzeciej w nocy w cronie.
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

  insert into public.ogloszenia_planowane (tytul, tresc, adresat, druzyna, pula, sms, kiedy, utworzyl)
  values (
    btrim(p_tytul), btrim(p_tresc), p_adresat,
    case when p_adresat = 'team' then p_druzyna end,
    case when p_adresat = 'pula' then p_pula end,
    coalesce(p_sms, false), p_kiedy, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.zaplanuj_ogloszenie(text, text, text, timestamptz, uuid, text, boolean) from public, anon;
grant  execute on function public.zaplanuj_ogloszenie(text, text, text, timestamptz, uuid, text, boolean) to authenticated;

create function public.anuluj_ogloszenie(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze wysylac ogloszenia';
  end if;
  update public.ogloszenia_planowane
  set anulowane_at = now()
  where id = p_id and wyslane_at is null and anulowane_at is null;
  if not found then
    raise exception 'To ogloszenie juz wyszlo albo jest anulowane';
  end if;
end;
$$;

revoke execute on function public.anuluj_ogloszenie(bigint) from public, anon;
grant  execute on function public.anuluj_ogloszenie(bigint) to authenticated;

-- Co minutę: dojrzałe ogłoszenia do skrzynki. `skip locked` - gdyby przebieg
-- się przeciągnął, następny nie wyśle tego samego drugi raz. Błąd jednego
-- (np. drużyna zniknęła) nie blokuje pozostałych: oznaczamy je jako anulowane.
create function public.wyslij_zaplanowane()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o   public.ogloszenia_planowane%rowtype;
  v_id  bigint;
  v_ile integer := 0;
begin
  for v_o in
    select * from public.ogloszenia_planowane
    where wyslane_at is null and anulowane_at is null and kiedy <= now()
    order by kiedy
    for update skip locked
  loop
    begin
      v_id := public.nadaj_ogloszenie(v_o.tytul, v_o.tresc, v_o.adresat, v_o.druzyna, v_o.pula, v_o.sms);
      update public.ogloszenia_planowane set wyslane_at = now(), powiadomienie_id = v_id where id = v_o.id;
      v_ile := v_ile + 1;
    exception when others then
      update public.ogloszenia_planowane set anulowane_at = now() where id = v_o.id;
    end;
  end loop;
  return v_ile;
end;
$$;

revoke execute on function public.wyslij_zaplanowane() from public, anon, authenticated;

select cron.schedule(
  'ogloszenia-planowane',
  '* * * * *',
  $$select public.wyslij_zaplanowane()
    where exists (
      select 1 from public.ogloszenia_planowane
      where wyslane_at is null and anulowane_at is null and kiedy <= now()
    )$$
);
