-- ============================================================================
-- Licytacje zamiast sklepiku (2026-10-22) - schemat, oferty, widok
-- ============================================================================
-- Projekt: docs/superpowers/specs/2026-10-22-licytacje-design.md.
-- Admin wystawia przedmiot (shop_items) na licytację, kapitanowie drużyn
-- przebijają się punktami drużyny. Prowadząca oferta blokuje punkty: dostępne
-- saldo = saldo z księgi - suma ofert, w których drużyna prowadzi. Do księgi
-- nic nie trafia aż do zamknięcia (osobna migracja).

alter table public.shop_items add column if not exists grafika text;

create table public.licytacje (
  id                  uuid primary key default gen_random_uuid(),
  item_id             uuid not null references public.shop_items(id),
  cena_wywolawcza     integer not null check (cena_wywolawcza > 0),
  start               timestamptz not null default now(),
  koniec              timestamptz not null,
  w_ciemno            boolean not null default false,
  status              text not null default 'trwa' check (status in ('trwa', 'zamknieta', 'anulowana')),
  otwarcie_ogloszone  boolean not null default false,
  zwyciezca_team      uuid references public.teams(id),
  cena_koncowa        integer,
  order_id            uuid references public.shop_orders(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  constraint licytacje_koniec_po_starcie check (koniec > start)
);

create index licytacje_trwajace_idx on public.licytacje (koniec) where status = 'trwa';

create table public.licytacje_oferty (
  id            uuid primary key default gen_random_uuid(),
  licytacja_id  uuid not null references public.licytacje(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kwota         integer not null check (kwota > 0),
  created_at    timestamptz not null default now()
);

create index licytacje_oferty_najwyzsza_idx on public.licytacje_oferty (licytacja_id, kwota desc);

insert into public.app_settings (key, value) values ('licytacja_krok', '10'::jsonb)
on conflict (key) do nothing;

-- ---------- RLS ----------
alter table public.licytacje enable row level security;
alter table public.licytacje_oferty enable row level security;

create policy licytacje_read on public.licytacje
  for select to authenticated using (public.is_approved() or public.is_admin());
create policy licytacje_admin_insert on public.licytacje
  for insert to authenticated with check (public.is_admin());
create policy licytacje_admin_update on public.licytacje
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy licytacje_admin_delete on public.licytacje
  for delete to authenticated using (public.is_admin());

-- Oferty tylko do odczytu z API - zapis wyłącznie przez licytuj().
create policy licytacje_oferty_read on public.licytacje_oferty
  for select to authenticated using (public.is_approved() or public.is_admin());

-- Realtime: ekran licytacji odświeża się po nowej ofercie i po zamknięciu.
alter publication supabase_realtime add table public.licytacje, public.licytacje_oferty;

-- ---------- Grafiki przedmiotów ----------
-- Bucket publiczny: grafika przedmiotu w ciemno nie wycieka, bo ścieżki
-- uczestnik nie dostaje (licytacje_lista), a nazwa pliku jest losowa.
insert into storage.buckets (id, name, public) values ('przedmioty', 'przedmioty', true)
on conflict (id) do nothing;

create policy przedmioty_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'przedmioty' and public.is_admin());
create policy przedmioty_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'przedmioty' and public.is_admin());
create policy przedmioty_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'przedmioty' and public.is_admin());

-- ---------- Najwyższa oferta w każdej licytacji ----------
-- Remis kwot jest niemożliwy (krok), ale created_at rozstrzyga deterministycznie.
create view public.licytacje_prowadzacy with (security_invoker = on) as
  select distinct on (licytacja_id) licytacja_id, team_id, user_id, kwota
  from public.licytacje_oferty
  order by licytacja_id, kwota desc, created_at;

-- ---------- Dostępne saldo drużyny ----------
create function public.dostepne_saldo(p_team uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(delta) from public.points_ledger where team_id = p_team), 0)
    - coalesce((
        select sum(p.kwota)
        from (
          select distinct on (o.licytacja_id) o.licytacja_id, o.team_id, o.kwota
          from public.licytacje_oferty o
          join public.licytacje l on l.id = o.licytacja_id
          where l.status = 'trwa'
          order by o.licytacja_id, o.kwota desc, o.created_at
        ) p
        where p.team_id = p_team
      ), 0)
  )::integer;
$$;

revoke execute on function public.dostepne_saldo(uuid) from public, anon;
grant execute on function public.dostepne_saldo(uuid) to authenticated;

-- ---------- Oferta ----------
create function public.licytuj(p_licytacja uuid, p_kwota integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team   uuid;
  v_l      public.licytacje;
  v_max    integer;
  v_lider  uuid;
  v_krok   integer;
  v_nazwa  text;
  v_item   text;
begin
  -- SECURITY DEFINER omija RLS - uprawnienia ręcznie. Kadra (drużyna ukryta,
  -- gdzie każdy admin jest kapitanem) nie licytuje.
  select p.team_id into v_team from public.profiles p where p.id = auth.uid();
  if not public.is_approved() or v_team is null or not public.is_captain(v_team)
     or (select ukryta from public.teams where id = v_team) then
    raise exception 'NIE_KAPITAN';
  end if;

  -- Blokady: najpierw licytacja (dwie oferty na nią idą po kolei), potem
  -- drużyna (zamek na jej saldo, jak w kup_z_polki). Ta sama kolejność
  -- w licytacje_tick - bez zakleszczeń.
  select * into v_l from public.licytacje where id = p_licytacja for update;
  if v_l.id is null or v_l.status <> 'trwa' or now() < v_l.start or now() >= v_l.koniec then
    raise exception 'LICYTACJA_NIEAKTYWNA';
  end if;

  select o.kwota, o.team_id into v_max, v_lider
  from public.licytacje_oferty o
  where o.licytacja_id = p_licytacja
  order by o.kwota desc, o.created_at
  limit 1;

  if v_lider = v_team then
    raise exception 'JUZ_PROWADZICIE';
  end if;

  select (value #>> '{}')::integer into v_krok from public.app_settings where key = 'licytacja_krok';
  v_krok := coalesce(v_krok, 10);

  if p_kwota is null or p_kwota < coalesce(v_max + v_krok, v_l.cena_wywolawcza) then
    raise exception 'ZA_MALO';
  end if;

  perform 1 from public.teams where id = v_team for update;
  if public.dostepne_saldo(v_team) < p_kwota then
    raise exception 'BRAK_PUNKTOW';
  end if;

  insert into public.licytacje_oferty (licytacja_id, team_id, user_id, kwota)
  values (p_licytacja, v_team, auth.uid(), p_kwota);

  if v_lider is not null then
    select name into v_nazwa from public.teams where id = v_team;
    select case when v_l.w_ciemno then 'Tajemnicza nagroda' else i.name end into v_item
    from public.shop_items i where i.id = v_l.item_id;
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'team', v_lider, 'Was przebito',
            v_item || ' - teraz ' || p_kwota || ' pkt (' || v_nazwa || ')',
            '/app/sklep', 'licytacja', p_licytacja::text);
  end if;
end;
$$;

revoke execute on function public.licytuj(uuid, integer) from public, anon;
grant execute on function public.licytuj(uuid, integer) to authenticated;

-- ---------- Lista dla ekranu ----------
-- Licytacja w ciemno: do zamknięcia uczestnik nie dostaje nazwy, opisu,
-- grafiki, ikony ani efektu. Trwające, zapowiedziane i zamknięte z 48 h.
create function public.licytacje_lista()
returns table (
  id uuid, status text, start timestamptz, koniec timestamptz, w_ciemno boolean,
  cena_wywolawcza integer, najwyzsza integer, prowadzi_team uuid, prowadzi_nazwa text,
  prowadzi_kolor text, liczba_ofert integer, nazwa text, opis text, grafika text,
  ikona text, efekt text, zwyciezca_team uuid, zwyciezca_nazwa text, cena_koncowa integer,
  order_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.status, l.start, l.koniec, l.w_ciemno, l.cena_wywolawcza,
         p.kwota, p.team_id, tp.name, tp.color,
         (select count(*)::integer from public.licytacje_oferty o where o.licytacja_id = l.id),
         case when j.jawne then i.name end,
         case when j.jawne then i.description end,
         case when j.jawne then i.grafika end,
         case when j.jawne then i.ikona end,
         case when j.jawne then i.effect_key end,
         l.zwyciezca_team, tz.name, l.cena_koncowa, l.order_id
  from public.licytacje l
  join public.shop_items i on i.id = l.item_id
  cross join lateral (select (not l.w_ciemno or l.status <> 'trwa' or public.is_admin()) as jawne) j
  left join public.licytacje_prowadzacy p on p.licytacja_id = l.id
  left join public.teams tp on tp.id = p.team_id
  left join public.teams tz on tz.id = l.zwyciezca_team
  where (public.is_approved() or public.is_admin())
    and l.status <> 'anulowana'
    and (l.status = 'trwa' or l.koniec > now() - interval '48 hours')
  order by l.koniec;
$$;

revoke execute on function public.licytacje_lista() from public, anon;
grant execute on function public.licytacje_lista() to authenticated;
