-- ============================================================
-- Sekta Wyjazdowa — zawody: Topalki, siatkówka, poker, szachy (paczka D2)
-- ============================================================
--
-- Decyzje Mikołaja 2026-10-11:
-- * Topalki (5 osób, co najmniej 1 dziewczyna - pole do odhaczenia) i
--   siatkówka (4 osoby): jedna osoba zapisuje cały skład z nazwą; składy
--   mieszane (spoza Drużyn 1-4); jedna osoba w jednym składzie na zawody;
--   bez limitu liczby składów.
-- * Wpisani dostają powiadomienie i mogą się sami wypisać, póki trwają zapisy.
-- * Okienko zapisów otwiera i zamyka admin; po zamknięciu układa terminarz
--   „każdy z każdym”, wpisuje wyniki, apka liczy tabelę.
-- * Poker i szachy: zapisy indywidualne z limitem miejsc.
-- * Punktów do rankingu zawody nie liczą - admin dodaje je ręcznie.
--
-- Uczestnik pisze wyłącznie przez funkcje poniżej (security definer, z blokadą
-- wiersza zawodów); admin zmienia tabele bezpośrednio.

create table zawody (
  id                uuid primary key default gen_random_uuid(),
  nazwa             text not null check (length(btrim(nazwa)) between 1 and 40),
  opis              text not null default '' check (length(opis) <= 500),
  druzynowe         boolean not null,
  rozmiar_skladu    integer check (rozmiar_skladu between 2 and 12),
  wymaga_dziewczyny boolean not null default false,
  limit_miejsc      integer check (limit_miejsc between 1 and 500),
  zapisy_otwarte    boolean not null default false,
  kolejnosc         integer not null default 0,
  created_at        timestamptz not null default now(),
  constraint zawody_rodzaj check (
    (druzynowe and rozmiar_skladu is not null and limit_miejsc is null)
    or (not druzynowe and rozmiar_skladu is null and not wymaga_dziewczyny)
  )
);

create table zawody_druzyny (
  id                      uuid primary key default gen_random_uuid(),
  zawody_id               uuid not null references zawody(id) on delete cascade,
  nazwa                   text not null check (length(btrim(nazwa)) between 1 and 40),
  zalozyciel_id           uuid not null references profiles(id) on delete cascade,
  dziewczyna_potwierdzona boolean not null default false,
  created_at              timestamptz not null default now()
);
create unique index zawody_druzyny_nazwa on zawody_druzyny (zawody_id, lower(btrim(nazwa)));

-- Klucz (zawody_id, user_id): jedna osoba w jednym składzie na zawody.
create table zawody_sklad (
  zawody_id  uuid not null references zawody(id) on delete cascade,
  druzyna_id uuid not null references zawody_druzyny(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (zawody_id, user_id)
);
create index zawody_sklad_druzyna on zawody_sklad (druzyna_id);

create table zawody_zapisy (
  zawody_id  uuid not null references zawody(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (zawody_id, user_id)
);

create table zawody_mecze (
  id         uuid primary key default gen_random_uuid(),
  zawody_id  uuid not null references zawody(id) on delete cascade,
  runda      integer not null check (runda >= 1),
  druzyna_a  uuid not null references zawody_druzyny(id) on delete cascade,
  druzyna_b  uuid not null references zawody_druzyny(id) on delete cascade,
  wynik_a    integer check (wynik_a between 0 and 999),
  wynik_b    integer check (wynik_b between 0 and 999),
  created_at timestamptz not null default now(),
  check (druzyna_a <> druzyna_b),
  check ((wynik_a is null) = (wynik_b is null))
);
create index zawody_mecze_zawody on zawody_mecze (zawody_id, runda);

-- ---------- RLS ----------
alter table zawody         enable row level security;
alter table zawody_druzyny enable row level security;
alter table zawody_sklad   enable row level security;
alter table zawody_zapisy  enable row level security;
alter table zawody_mecze   enable row level security;

create policy zawody_read on zawody for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy zawody_admin on zawody for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy zawody_druzyny_read on zawody_druzyny for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy zawody_druzyny_admin on zawody_druzyny for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy zawody_sklad_read on zawody_sklad for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy zawody_sklad_admin on zawody_sklad for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy zawody_zapisy_read on zawody_zapisy for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy zawody_zapisy_admin on zawody_zapisy for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy zawody_mecze_read on zawody_mecze for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy zawody_mecze_admin on zawody_mecze for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Kto może grać ----------
-- Przyjęci uczestnicy z nazwą z apki (ksywka) - lista do dobierania składu.
-- Bez imion i nazwisk: w apce wszyscy widzą się po ksywkach.
create function public.zawody_gracze()
returns table (id uuid, nazwa text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(btrim(p.display_name), ''), 'Bez ksywki')
  from public.profiles p
  where p.status = 'approved'::public.user_status
    and (public.is_approved() or public.is_admin())
  order by 2;
$$;
revoke execute on function public.zawody_gracze() from public, anon;
grant execute on function public.zawody_gracze() to authenticated;

-- Nazwa z apki do powiadomień i komunikatów.
create function public.zawody_nazwa_osoby(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(display_name), ''), 'Ktoś') from public.profiles where id = p_id;
$$;
revoke execute on function public.zawody_nazwa_osoby(uuid) from public, anon, authenticated;

-- ---------- Skład ----------
create function public.zapisz_druzyne(
  p_zawody     uuid,
  p_nazwa      text,
  p_czlonkowie uuid[],
  p_dziewczyna boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_z      public.zawody%rowtype;
  v_sklad  uuid[];
  v_zajeci text;
  v_id     uuid;
  v_nazwa  text := btrim(coalesce(p_nazwa, ''));
begin
  if v_user is null or not public.is_approved() then
    raise exception 'Zapisy na zawody tylko dla przyjetych uczestnikow';
  end if;

  -- Blokada zawodów: dwa składy z tą samą osobą zapisywane naraz nie
  -- przejdą obok siebie, a zamknięcie zapisów czeka na trwające zapisy.
  select * into v_z from public.zawody where id = p_zawody for update;
  if not found then raise exception 'Nie ma takich zawodow'; end if;
  if not v_z.druzynowe then raise exception 'Na te zawody zapisuje sie indywidualnie'; end if;
  if not v_z.zapisy_otwarte then raise exception 'ZAPISY_ZAMKNIETE'; end if;

  if length(v_nazwa) not between 1 and 40 then
    raise exception 'NAZWA_DRUZYNY_DLUGOSC';
  end if;

  select array_agg(distinct x) into v_sklad
  from unnest(coalesce(p_czlonkowie, array[]::uuid[]) || v_user) as x
  where x is not null;

  if cardinality(v_sklad) <> v_z.rozmiar_skladu then
    raise exception 'SKLAD_ROZMIAR: sklad liczy % osob razem z Toba', v_z.rozmiar_skladu;
  end if;

  if (select count(*) from public.profiles
      where id = any(v_sklad) and status = 'approved'::public.user_status) <> cardinality(v_sklad) then
    raise exception 'SKLAD_NIEPRZYJETY';
  end if;

  if v_z.wymaga_dziewczyny and p_dziewczyna is not true then
    raise exception 'SKLAD_BEZ_DZIEWCZYNY';
  end if;

  select string_agg(public.zawody_nazwa_osoby(s.user_id), ', ') into v_zajeci
  from public.zawody_sklad s
  where s.zawody_id = p_zawody and s.user_id = any(v_sklad);
  if v_zajeci is not null then
    raise exception 'SKLAD_ZAJETY: %', v_zajeci;
  end if;

  if exists (select 1 from public.zawody_druzyny
             where zawody_id = p_zawody and lower(btrim(nazwa)) = lower(v_nazwa)) then
    raise exception 'NAZWA_DRUZYNY_ZAJETA';
  end if;

  insert into public.zawody_druzyny (zawody_id, nazwa, zalozyciel_id, dziewczyna_potwierdzona)
  values (p_zawody, v_nazwa, v_user, coalesce(p_dziewczyna, false))
  returning id into v_id;

  insert into public.zawody_sklad (zawody_id, druzyna_id, user_id)
  select p_zawody, v_id, x from unnest(v_sklad) as x;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  select 'push', 'user', x, 'Jesteś w składzie: ' || v_z.nazwa,
         format('%s wpisuje Cię do składu „%s”. Nie grasz? Wypisz się w apce, póki trwają zapisy.',
                public.zawody_nazwa_osoby(v_user), v_nazwa),
         '/app/zawody/' || p_zawody, 'zawody', v_id::text
  from unnest(v_sklad) as x
  where x <> v_user;

  return v_id;
end;
$$;
revoke execute on function public.zapisz_druzyne(uuid, text, uuid[], boolean) from public, anon;
grant execute on function public.zapisz_druzyne(uuid, text, uuid[], boolean) to authenticated;

-- Zakładający dobiera osobę na zwolnione miejsce.
create function public.dodaj_do_skladu(p_druzyna uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.zawody_druzyny%rowtype;
  v_z public.zawody%rowtype;
begin
  select * into v_d from public.zawody_druzyny where id = p_druzyna;
  if not found then raise exception 'Nie ma takiego skladu'; end if;
  select * into v_z from public.zawody where id = v_d.zawody_id for update;

  if v_d.zalozyciel_id <> auth.uid() then
    raise exception 'Sklad uzupelnia osoba, ktora go zapisala';
  end if;
  if not v_z.zapisy_otwarte then raise exception 'ZAPISY_ZAMKNIETE'; end if;
  if (select count(*) from public.zawody_sklad where druzyna_id = p_druzyna) >= v_z.rozmiar_skladu then
    raise exception 'Sklad jest juz pelny';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'approved'::public.user_status) then
    raise exception 'SKLAD_NIEPRZYJETY';
  end if;
  if exists (select 1 from public.zawody_sklad where zawody_id = v_z.id and user_id = p_user) then
    raise exception 'SKLAD_ZAJETY: %', public.zawody_nazwa_osoby(p_user);
  end if;

  insert into public.zawody_sklad (zawody_id, druzyna_id, user_id) values (v_z.id, p_druzyna, p_user);

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'user', p_user, 'Jesteś w składzie: ' || v_z.nazwa,
          format('%s wpisuje Cię do składu „%s”. Nie grasz? Wypisz się w apce, póki trwają zapisy.',
                 public.zawody_nazwa_osoby(auth.uid()), v_d.nazwa),
          '/app/zawody/' || v_z.id, 'zawody', p_druzyna::text);
end;
$$;
revoke execute on function public.dodaj_do_skladu(uuid, uuid) from public, anon;
grant execute on function public.dodaj_do_skladu(uuid, uuid) to authenticated;

-- ---------- Zapis indywidualny ----------
create function public.zapisz_sie_na_zawody(p_zawody uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.zawody%rowtype;
begin
  if auth.uid() is null or not public.is_approved() then
    raise exception 'Zapisy na zawody tylko dla przyjetych uczestnikow';
  end if;
  select * into v_z from public.zawody where id = p_zawody for update;
  if not found then raise exception 'Nie ma takich zawodow'; end if;
  if v_z.druzynowe then raise exception 'Na te zawody zapisuje sie caly sklad'; end if;
  if not v_z.zapisy_otwarte then raise exception 'ZAPISY_ZAMKNIETE'; end if;
  if exists (select 1 from public.zawody_zapisy where zawody_id = p_zawody and user_id = auth.uid()) then
    return;
  end if;
  if v_z.limit_miejsc is not null
     and (select count(*) from public.zawody_zapisy where zawody_id = p_zawody) >= v_z.limit_miejsc then
    raise exception 'ZAWODY_PELNE';
  end if;
  insert into public.zawody_zapisy (zawody_id, user_id) values (p_zawody, auth.uid());
end;
$$;
revoke execute on function public.zapisz_sie_na_zawody(uuid) from public, anon;
grant execute on function public.zapisz_sie_na_zawody(uuid) to authenticated;

-- ---------- Wypisanie ----------
-- Indywidualnie: zwalnia miejsce. W składzie: zwykły członek wychodzi
-- (zakładający dostaje push, żeby dobrać kogoś), zakładający rozwiązuje skład.
create function public.wypisz_sie_z_zawodow(p_zawody uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_z    public.zawody%rowtype;
  v_d    public.zawody_druzyny%rowtype;
begin
  select * into v_z from public.zawody where id = p_zawody for update;
  if not found then raise exception 'Nie ma takich zawodow'; end if;
  if not v_z.zapisy_otwarte then
    raise exception 'ZAPISY_ZAMKNIETE';
  end if;

  if not v_z.druzynowe then
    delete from public.zawody_zapisy where zawody_id = p_zawody and user_id = v_user;
    return;
  end if;

  select d.* into v_d
  from public.zawody_sklad s join public.zawody_druzyny d on d.id = s.druzyna_id
  where s.zawody_id = p_zawody and s.user_id = v_user;
  if not found then return; end if;

  if v_d.zalozyciel_id = v_user then
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    select 'push', 'user', s.user_id, 'Skład rozwiązany: ' || v_z.nazwa,
           format('Skład „%s” został rozwiązany przez osobę, która go zapisała.', v_d.nazwa),
           '/app/zawody/' || p_zawody, 'zawody', v_d.id::text
    from public.zawody_sklad s where s.druzyna_id = v_d.id and s.user_id <> v_user;
    delete from public.zawody_druzyny where id = v_d.id;
  else
    delete from public.zawody_sklad where zawody_id = p_zawody and user_id = v_user;
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'user', v_d.zalozyciel_id, 'Ktoś opuszcza skład: ' || v_z.nazwa,
            format('%s wypisuje się ze składu „%s”. Dobierz kogoś, póki trwają zapisy.',
                   public.zawody_nazwa_osoby(v_user), v_d.nazwa),
            '/app/zawody/' || p_zawody, 'zawody', v_d.id::text);
  end if;
end;
$$;
revoke execute on function public.wypisz_sie_z_zawodow(uuid) from public, anon;
grant execute on function public.wypisz_sie_z_zawodow(uuid) to authenticated;

-- ---------- Terminarz każdy z każdym ----------
-- Metoda koła: pierwszy skład stoi, reszta się obraca; przy nieparzystej
-- liczbie dochodzi pauza (NULL), z którą nikt nie gra. Zapisy muszą być
-- zamknięte, a istniejący terminarz bez wyników - ułożenie od nowa
-- skasowałoby wpisane wyniki.
create function public.uloz_mecze(p_zawody uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z      public.zawody%rowtype;
  v_ids    uuid[];
  v_n      integer;
  v_runda  integer;
  v_i      integer;
  v_a      uuid;
  v_b      uuid;
  v_razem  integer := 0;
begin
  if not public.is_admin() then raise exception 'Terminarz uklada admin'; end if;
  select * into v_z from public.zawody where id = p_zawody for update;
  if not found or not v_z.druzynowe then raise exception 'Terminarz tylko dla zawodow druzynowych'; end if;
  if v_z.zapisy_otwarte then raise exception 'Najpierw zamknij zapisy'; end if;
  if exists (select 1 from public.zawody_mecze where zawody_id = p_zawody and wynik_a is not null) then
    raise exception 'MECZE_MAJA_WYNIKI';
  end if;

  delete from public.zawody_mecze where zawody_id = p_zawody;

  select array_agg(id order by created_at) into v_ids
  from public.zawody_druzyny where zawody_id = p_zawody;
  if coalesce(cardinality(v_ids), 0) < 2 then
    raise exception 'Za malo skladow na terminarz';
  end if;
  if cardinality(v_ids) % 2 = 1 then
    v_ids := v_ids || array[null::uuid];
  end if;
  v_n := cardinality(v_ids);

  for v_runda in 1 .. v_n - 1 loop
    for v_i in 1 .. v_n / 2 loop
      v_a := v_ids[v_i];
      v_b := v_ids[v_n + 1 - v_i];
      if v_a is not null and v_b is not null then
        insert into public.zawody_mecze (zawody_id, runda, druzyna_a, druzyna_b)
        values (p_zawody, v_runda, v_a, v_b);
        v_razem := v_razem + 1;
      end if;
    end loop;
    -- Obrót: pierwszy zostaje, ostatni wskakuje na drugie miejsce.
    v_ids := array[v_ids[1]] || array[v_ids[v_n]] || v_ids[2 : v_n - 1];
  end loop;

  return v_razem;
end;
$$;
revoke execute on function public.uloz_mecze(uuid) from public, anon;
grant execute on function public.uloz_mecze(uuid) to authenticated;

-- ---------- Start ----------
insert into zawody (nazwa, opis, druzynowe, rozmiar_skladu, wymaga_dziewczyny, limit_miejsc, kolejnosc) values
  ('Topalki', 'Crème de la crème wyjazdu. Pięcioosobowe składy, w każdym co najmniej jedna dziewczyna.', true, 5, true, null, 1),
  ('Siatkówka', 'Czteroosobowe składy, każdy z każdym.', true, 4, false, null, 2),
  ('Poker', 'Turniej indywidualny.', false, null, false, 16, 3),
  ('Szachy', 'Turniej indywidualny.', false, null, false, 16, 4);

-- ---------- Retencja ----------
-- Kopia sprzataj_zabawy z 20261009120300 z dopisanymi zawodami.
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
  -- Zawody (20261011170000): składy, zapisy i mecze trzymają osoby.
  delete from public.zawody_druzyny where true;     -- skład i mecze kaskadą
  delete from public.zawody_zapisy where true;

  return jsonb_build_object('wykonane', true, 'pliki_zlecone', v_pliki);
end;
$$;
