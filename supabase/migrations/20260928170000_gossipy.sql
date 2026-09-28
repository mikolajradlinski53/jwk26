-- ============================================================
-- Sekta Wyjazdowa — gossipy
-- ============================================================
--
-- Mapa mechanizmów, plan 12. Admin tworzy kategorię z nominowanymi,
-- przyjęci głosują raz, z uzasadnieniem, nie na siebie. Przed ujawnieniem
-- nie widać nic; po ujawnieniu wyłącznie zwycięzcę (remis = kilku)
-- i anonimowe uzasadnienia o nim — uzasadnienia o innych zdradzałyby,
-- ile kto dostał głosów. Bez punktów.
--
-- Anonimowość jest w bazie, nie w interfejsie: tabela głosów nie ma żadnego
-- grantu SELECT, a jedyne odczyty dla uczestnika idą przez funkcję, która
-- nigdy nie zwraca autora (§5 speca głównego). Autora widzi wyłącznie admin,
-- przez osobną funkcję do moderacji.

create table gossip_categories (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  status      text not null default 'otwarta'
                check (status in ('otwarta', 'zamknieta', 'ujawniona')),
  created_at  timestamptz not null default now(),
  revealed_at timestamptz
);

create table gossip_nominees (
  category_id uuid not null references gossip_categories(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  primary key (category_id, profile_id)
);

create table gossip_votes (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references gossip_categories(id) on delete cascade,
  voter_id      uuid not null references profiles(id) on delete cascade,
  nominee_id    uuid not null references profiles(id) on delete cascade,
  justification text not null check (length(justification) <= 2000),
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  -- Jeden głos na kategorię. Indeks, nie tylko sprawdzenie w funkcji:
  -- dwa równoległe wywołania nie przejdą obok siebie.
  unique (category_id, voter_id),
  check (voter_id <> nominee_id)
);

alter table gossip_categories enable row level security;
alter table gossip_nominees   enable row level security;
alter table gossip_votes      enable row level security;

-- Żadnych polityk i żadnych grantów: wszystko przez funkcje poniżej.
-- Dla gossip_votes to sedno — `select voter_id` z konsoli musi dostać
-- odmowę, a nie pustą listę (pusta lista mogłaby się też zmienić w pełną
-- po jednej nieostrożnej polityce).
revoke all on gossip_categories from anon, authenticated;
revoke all on gossip_nominees   from anon, authenticated;
revoke all on gossip_votes      from anon, authenticated;

-- ---------- Admin: kategorie ----------
create function public.utworz_kategorie(p_tytul text, p_opis text, p_nominowani uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_liczba integer;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin tworzy kategorie';
  end if;

  select count(distinct p.id) into v_liczba
  from public.profiles p
  where p.id = any(coalesce(p_nominowani, '{}')) and p.status = 'approved';

  -- Tylko przyjęci i tylko wtedy, gdy wszyscy wskazani są przyjęci — cicho
  -- pominięta osoba zmieniłaby kategorię bez wiedzy admina.
  if v_liczba < 2 or v_liczba > 8
     or v_liczba <> cardinality(array(select distinct unnest(p_nominowani))) then
    raise exception 'Kategoria potrzebuje od 2 do 8 przyjetych nominowanych';
  end if;

  insert into public.gossip_categories (title, description)
  values (btrim(p_tytul), nullif(btrim(p_opis), ''))
  returning id into v_id;

  insert into public.gossip_nominees (category_id, profile_id)
  select v_id, x from (select distinct unnest(p_nominowani) as x) n;

  return v_id;
end;
$$;

-- Otwarta ↔ zamknięta w obie strony (np. dogrywka), ujawniona tylko z zamkniętej
-- i bez powrotu: raz ogłoszonego wyniku nie da się „odogłosić".
create function public.zmien_status_kategorii(p_kategoria uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obecny text;
  v_tytul  text;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin zmienia status kategorii';
  end if;

  select status, title into v_obecny, v_tytul
  from public.gossip_categories where id = p_kategoria for update;
  if v_obecny is null then
    raise exception 'Nieznana kategoria';
  end if;

  if v_obecny = 'ujawniona'
     or (p_status = 'ujawniona' and v_obecny <> 'zamknieta')
     or p_status not in ('otwarta', 'zamknieta', 'ujawniona') then
    raise exception 'Niedozwolona zmiana: % -> %', v_obecny, p_status;
  end if;

  update public.gossip_categories
  set status = p_status,
      revealed_at = case when p_status = 'ujawniona' then now() end
  where id = p_kategoria;

  if p_status = 'ujawniona' then
    insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
    values ('push', 'all', 'Wyniki gossipów', 'Ujawniono: ' || v_tytul, '/app/gossip',
            'gossip', p_kategoria::text);
  end if;
end;
$$;

-- ---------- Uczestnik: głos ----------
create function public.oddaj_glos(p_kategoria uuid, p_nominowany uuid, p_uzasadnienie text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_min    integer;
begin
  if not public.is_approved() then
    raise exception 'Glosuja tylko przyjeci uczestnicy';
  end if;

  select status into v_status from public.gossip_categories where id = p_kategoria;
  if v_status is distinct from 'otwarta' then
    raise exception 'Kategoria nie jest otwarta';
  end if;

  if p_nominowany = auth.uid() then
    raise exception 'Nie mozna glosowac na siebie';
  end if;

  if not exists (
    select 1 from public.gossip_nominees
    where category_id = p_kategoria and profile_id = p_nominowany
  ) then
    raise exception 'Ta osoba nie jest nominowana w tej kategorii';
  end if;

  select coalesce((value #>> '{}')::integer, 200) into v_min
  from public.app_settings where key = 'gossip_min_justification';

  if length(btrim(coalesce(p_uzasadnienie, ''))) < coalesce(v_min, 200) then
    raise exception 'Uzasadnienie musi miec co najmniej % znakow', coalesce(v_min, 200);
  end if;

  begin
    insert into public.gossip_votes (category_id, voter_id, nominee_id, justification)
    values (p_kategoria, auth.uid(), p_nominowany, btrim(p_uzasadnienie));
  exception when unique_violation then
    raise exception 'Glos w tej kategorii juz oddany';
  end;
end;
$$;

-- ---------- Uczestnik: odczyt ----------
-- Jedyne okno na gossipy dla uczestnika. Nie zwraca autora ani liczb głosów.
-- `moj_glos` to własny wybór — anonimowości nie łamie, a pozwala pokazać
-- „już zagłosowane".
create function public.gossipy()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with zliczone as (
    select v.category_id, v.nominee_id, count(*) as n
    from public.gossip_votes v
    group by v.category_id, v.nominee_id
  ), najlepsi as (
    select z.category_id, z.nominee_id
    from zliczone z
    where z.n = (select max(n) from zliczone z2 where z2.category_id = z.category_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id,
    'tytul', k.title,
    'opis', k.description,
    'status', k.status,
    'nominowani', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nazwa', coalesce(p.display_name, 'Bez nazwy'))
                                order by p.display_name), '[]'::jsonb)
      from public.gossip_nominees n join public.profiles p on p.id = n.profile_id
      where n.category_id = k.id
    ),
    'moj_glos', (
      select v.nominee_id from public.gossip_votes v
      where v.category_id = k.id and v.voter_id = auth.uid()
    ),
    'zwyciezcy', case when k.status = 'ujawniona' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nazwa', coalesce(p.display_name, 'Bez nazwy'))
                                order by p.display_name), '[]'::jsonb)
      from najlepsi b join public.profiles p on p.id = b.nominee_id
      where b.category_id = k.id
    ) end,
    'uzasadnienia', case when k.status = 'ujawniona' then (
      select coalesce(jsonb_agg(v.justification order by v.created_at), '[]'::jsonb)
      from public.gossip_votes v
      where v.category_id = k.id
        and not v.hidden
        and v.nominee_id in (select b.nominee_id from najlepsi b where b.category_id = k.id)
    ) end
  ) order by k.created_at desc), '[]'::jsonb)
  from public.gossip_categories k
  where public.is_approved() or public.is_admin();
$$;

-- ---------- Admin: moderacja ----------
create function public.moderacja_gossipow(p_kategoria uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moderuje gossipy';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id,
      'autor', coalesce(a.display_name, a.email),
      'na_kogo', coalesce(n.display_name, n.email),
      'tekst', v.justification,
      'ukryte', v.hidden,
      'kiedy', v.created_at
    ) order by v.created_at), '[]'::jsonb)
    from public.gossip_votes v
    join public.profiles a on a.id = v.voter_id
    join public.profiles n on n.id = v.nominee_id
    where v.category_id = p_kategoria
  );
end;
$$;

create function public.ukryj_uzasadnienie(p_glos uuid, p_ukryte boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moderuje gossipy';
  end if;
  update public.gossip_votes set hidden = coalesce(p_ukryte, true) where id = p_glos;
end;
$$;

revoke execute on function public.utworz_kategorie(text, text, uuid[]) from public, anon;
grant  execute on function public.utworz_kategorie(text, text, uuid[]) to authenticated;
revoke execute on function public.zmien_status_kategorii(uuid, text) from public, anon;
grant  execute on function public.zmien_status_kategorii(uuid, text) to authenticated;
revoke execute on function public.oddaj_glos(uuid, uuid, text) from public, anon;
grant  execute on function public.oddaj_glos(uuid, uuid, text) to authenticated;
revoke execute on function public.gossipy() from public, anon;
grant  execute on function public.gossipy() to authenticated;
revoke execute on function public.moderacja_gossipow(uuid) from public, anon;
grant  execute on function public.moderacja_gossipow(uuid) to authenticated;
revoke execute on function public.ukryj_uzasadnienie(uuid, boolean) from public, anon;
grant  execute on function public.ukryj_uzasadnienie(uuid, boolean) to authenticated;
