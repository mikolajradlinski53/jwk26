-- ============================================================
-- Sekta Wyjazdowa — powiadomienia push i ogłoszenia
-- ============================================================
--
-- Mapa mechanizmów, plan 11. Wszystko płynie przez istniejącą tabelę
-- `powiadomienia` (outbox ze sklepiku): mechanizm dopisuje wiersz z kanałem
-- `push`, wyzwalacz przez pg_net woła trasę /api/push, a trasa pobiera paczkę
-- funkcją pobierz_push i wysyła ją biblioteką web-push. pg_cron co minutę
-- ponawia to, co utknęło. Trasa nie ma klucza serwisowego — jak skrypt
-- arkusza dostaje klucz anon i sekret z tabeli `sekrety`.

create extension if not exists pg_net with schema extensions;

-- ---------- Subskrypcje ----------
-- Jedno urządzenie = jeden endpoint. Ten sam telefon po przelogowaniu na
-- inne konto przejmuje subskrypcję (upsert po endpoincie), zamiast wysyłać
-- powiadomienia dwóm osobom naraz.
create table push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique check (length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_read_own on push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Zapis wyłącznie przez zapisz_subskrypcje / usun_subskrypcje.
revoke all on push_subscriptions from anon;
revoke insert, update, delete, truncate on push_subscriptions from authenticated;

-- ---------- Outbox: nowi adresaci, link, próby ----------
alter table powiadomienia drop constraint if exists powiadomienia_adresat_check;
alter table powiadomienia
  add constraint powiadomienia_adresat_check
    check (adresat in ('admin', 'team', 'user', 'all', 'pula')),
  add column pula       text references pule(klucz),
  -- Tylko ścieżki wewnątrz apki: link z powiadomienia nie wyprowadzi nikogo
  -- na obcą stronę, nawet gdyby ktoś dopisał wiersz z pełnym adresem.
  add column link       text check (link is null or link ~ '^/[^/]'),
  add column proby      smallint not null default 0,
  add column wyslane_do integer;

-- ---------- Sekrety wysyłki ----------
-- `push_url` pusty = wysyłka wyłączona. Tak zostaje na projekcie testowym,
-- żeby testy nie dzwoniły na produkcję; na produkcji ustawiany ręcznie na
-- adres trasy /api/push po wdrożeniu.
insert into sekrety (klucz, wartosc) values
  ('push',     replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('push_url', '')
on conflict (klucz) do nothing;

-- ---------- Adresaci ----------
-- „Wszyscy", drużyna i pula to wyłącznie osoby przyjęte — czekający na
-- akceptację nie dostają ogłoszeń z wyjazdu. Wyjątek: adresat `user`, bo
-- powiadomienie o przyjęciu idzie właśnie do świeżo przyjętej osoby.
create function public.adresaci_powiadomienia(p_adresat text, p_id uuid, p_pula text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where (p_adresat = 'user'  and p.id = p_id)
     or (p_adresat = 'admin' and p.role = 'admin')
     or (p_adresat = 'all'   and p.status = 'approved')
     or (p_adresat = 'team'  and p.status = 'approved' and p.team_id = p_id)
     or (p_adresat = 'pula'  and p.status = 'approved' and exists (
           select 1 from public.registrations r
           where r.user_id = p.id
             and r.status = 'approved'::public.user_status
             and r.pula = p_pula
         ));
$$;

revoke execute on function public.adresaci_powiadomienia(text, uuid, text)
  from public, anon, authenticated;

-- ---------- Dzwonek do trasy wysyłki ----------
-- pg_net kolejkuje żądanie w transakcji i wysyła je po zatwierdzeniu, więc
-- trasa zawsze widzi już zapisany wiersz.
create function public.pchnij_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_sekret text;
begin
  select wartosc into v_url from public.sekrety where klucz = 'push_url';
  if coalesce(v_url, '') = '' then
    return;
  end if;
  select wartosc into v_sekret from public.sekrety where klucz = 'push';

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-sekret', v_sekret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.pchnij_push() from public, anon, authenticated;

create function public.po_nowym_powiadomieniu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kanal = 'push' then
    perform public.pchnij_push();
  end if;
  return null;
end;
$$;

create trigger powiadomienia_push
  after insert on powiadomienia
  for each row execute function public.po_nowym_powiadomieniu();

-- Ponawianie: co minutę, tylko gdy coś czeka dłużej niż pół minuty — świeże
-- wiersze obsługuje wyzwalacz, a pusty przebieg nie dzwoni nigdzie.
select cron.schedule(
  'ponow-push',
  '* * * * *',
  $$select public.pchnij_push()
    where exists (
      select 1 from public.powiadomienia
      where kanal = 'push' and wyslane_at is null and proby < 5
        and created_at < now() - interval '30 seconds'
    )$$
);

-- ---------- Paczka do wysłania ----------
-- Najwyżej 50 powiadomień naraz, każde z subskrypcjami adresatów. Pobranie
-- podbija licznik prób: powiadomienie, którego nie da się dostarczyć (np.
-- trasa pada), po pięciu próbach przestaje wracać, zamiast krążyć w pg_cron
-- bez końca. `skip locked`: dwa równoległe wywołania nie dostaną tej samej paczki.
create function public.pobierz_push(p_sekret text)
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
  from public.sekrety where klucz = 'push';
  if v_ok is not true then
    raise exception 'Brak dostepu';
  end if;

  with paczka as (
    select p.id
    from public.powiadomienia p
    where p.kanal = 'push' and p.wyslane_at is null and p.proby < 5
    order by p.id
    limit 50
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
      'link',  coalesce(z.link, '/app'),
      'subskrypcje', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s
        where s.user_id in (select public.adresaci_powiadomienia(z.adresat, z.adresat_id, z.pula))
      ), '[]'::jsonb)
    ) order by z.id), '[]'::jsonb)
  into v_wynik
  from zliczone z;

  return v_wynik;
end;
$$;

-- Oznaczenie po wysyłce. `p_martwe` to endpointy, dla których serwer push
-- odpowiedział 404/410 — telefon wypisał się albo apka zniknęła. Kasujemy je,
-- żeby każda kolejna wysyłka nie traciła czasu na martwe adresy.
create function public.oznacz_push(
  p_sekret  text,
  p_id      bigint,
  p_wyslane integer,
  p_martwe  text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select p_sekret is not null and p_sekret = wartosc into v_ok
  from public.sekrety where klucz = 'push';
  if v_ok is not true then
    raise exception 'Brak dostepu';
  end if;

  update public.powiadomienia
  set wyslane_at = now(), wyslane_do = greatest(coalesce(p_wyslane, 0), 0)
  where id = p_id;

  delete from public.push_subscriptions
  where endpoint = any(coalesce(p_martwe, '{}'));
end;
$$;

-- Tylko trasa (anon + sekret) i klucz serwisowy — nie sesja w apce.
revoke execute on function public.pobierz_push(text) from public, anon, authenticated;
grant  execute on function public.pobierz_push(text) to anon, service_role;
revoke execute on function public.oznacz_push(text, bigint, integer, text[]) from public, anon, authenticated;
grant  execute on function public.oznacz_push(text, bigint, integer, text[]) to anon, service_role;

-- ---------- Subskrypcja z apki ----------
-- Dostępne także dla czekających na akceptację: pierwsze powiadomienie,
-- jakie ktoś dostaje, to właśnie „zgłoszenie przyjęte".
create function public.zapisz_subskrypcje(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'Niepoprawny adres subskrypcji';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create function public.usun_subskrypcje(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.zapisz_subskrypcje(text, text, text) from public, anon;
grant  execute on function public.zapisz_subskrypcje(text, text, text) to authenticated;
revoke execute on function public.usun_subskrypcje(text) from public, anon;
grant  execute on function public.usun_subskrypcje(text) to authenticated;

-- ---------- Ogłoszenie z panelu ----------
create function public.wyslij_ogloszenie(
  p_tytul   text,
  p_tresc   text,
  p_adresat text,
  p_druzyna uuid default null,
  p_pula    text default null
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

  return v_id;
end;
$$;

revoke execute on function public.wyslij_ogloszenie(text, text, text, uuid, text) from public, anon;
grant  execute on function public.wyslij_ogloszenie(text, text, text, uuid, text) to authenticated;

-- ---------- Automaty ----------
-- Wyzwalacze zamiast wpisywania powiadomień w review_registration i review_bingo:
-- obie funkcje zostają nietknięte, a automat działa niezależnie od tego,
-- którą drogą status się zmienił.
create function public.powiadom_o_przyjeciu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved'::public.user_status
     and old.status is distinct from 'approved'::public.user_status then
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'user', new.user_id, 'Zgłoszenie przyjęte',
            'Witaj na JWK26! Sprawdź w apce swoją drużynę.', '/app', 'registration', new.id::text);
  end if;
  return null;
end;
$$;

create trigger registrations_przyjecie
  after update of status on registrations
  for each row execute function public.powiadom_o_przyjeciu();

create function public.powiadom_o_bingo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tytul  text;
  v_punkty integer;
begin
  if new.status = 'approved'::public.user_status
     and old.status is distinct from 'approved'::public.user_status then
    select title, points into v_tytul, v_punkty from public.bingo_tasks where id = new.task_id;
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'team', new.team_id, 'Pole bingo zaliczone',
            coalesce(v_tytul, 'Zadanie') || ' — +' || coalesce(v_punkty, 0) || ' pkt dla drużyny',
            '/app/bingo', 'bingo', new.id::text);
  end if;
  return null;
end;
$$;

create trigger bingo_zaliczone
  after update of status on bingo_submissions
  for each row execute function public.powiadom_o_bingo();

revoke execute on function public.po_nowym_powiadomieniu() from public, anon, authenticated;
revoke execute on function public.powiadom_o_przyjeciu() from public, anon, authenticated;
revoke execute on function public.powiadom_o_bingo() from public, anon, authenticated;
