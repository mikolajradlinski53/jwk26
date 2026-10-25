-- Kasyno po gali (2026-10-25): gra na żetonach, ranking JWK zamrożony.
--
-- Przełącznik `kasyno_zetony` (domyślnie false). Gdy true:
--  * każdy wpis kategorii 'kasyno' do points_ledger trafia na konto żetonów
--    (trigger przechwytuje insert i go pomija) - sloty i blackjack działają
--    bez zmian, a punkty drużyn i ranking stoją w miejscu;
--  * limit gry = obrót w oknie + saldo żetonów, czyli stawka nie może
--    przekroczyć salda - bez limitu czasowego, a pusty portfel ratuje dokładka;
--  * każdy spin dosypuje do wspólnego jackpotu; trójka Oka go zgarnia;
--  * wyzwania 1 na 1: dwie karty dla każdego, bliżej 21 wygrywa pulę.

insert into public.app_settings (key, value) values
  ('kasyno_zetony', 'false'::jsonb),
  ('kasyno_zetony_start', '1000'::jsonb),
  ('kasyno_jackpot_wplata', '2'::jsonb),
  ('kasyno_jackpot_start', '500'::jsonb)
on conflict (key) do nothing;

create table public.kasyno_zetony (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  saldo      integer not null,
  dokladki   integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.kasyno_zetony enable row level security;
create policy kasyno_zetony_wlasne on public.kasyno_zetony for select
  using (user_id = (select auth.uid()) or public.is_admin());

create table public.kasyno_jackpot (
  id         boolean primary key default true check (id),
  kwota      integer not null,
  ostatni_zwyciezca uuid references public.profiles(id) on delete set null,
  ostatnia_wygrana  integer,
  ostatnio_at       timestamptz
);
alter table public.kasyno_jackpot enable row level security;
create policy kasyno_jackpot_czytaj on public.kasyno_jackpot for select using (public.is_approved() or public.is_admin());
insert into public.kasyno_jackpot (kwota) values (500);

create table public.kasyno_wyzwania (
  id          uuid primary key default gen_random_uuid(),
  od          uuid not null references public.profiles(id) on delete cascade,
  do_kogo     uuid not null references public.profiles(id) on delete cascade,
  stawka      integer not null check (stawka between 10 and 500),
  status      text not null default 'czeka' check (status in ('czeka', 'rozegrane', 'odrzucone', 'anulowane')),
  karty_od    text[],
  karty_do    text[],
  zwyciezca   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  rozegrane_at timestamptz,
  check (od <> do_kogo)
);
alter table public.kasyno_wyzwania enable row level security;
create policy kasyno_wyzwania_moje on public.kasyno_wyzwania for select
  using ((select auth.uid()) in (od, do_kogo) or public.is_admin());

-- ---------- żetony ----------
create function public.kasyno_tryb_zetony()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'kasyno_zetony'), false);
$$;

/** Zmienia saldo żetonów (pierwszy raz zakłada konto ze startową pulą). */
create function public.zetony_zmien(p_user uuid, p_delta integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_saldo integer;
begin
  insert into public.kasyno_zetony (user_id, saldo)
  values (p_user, coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_zetony_start'), 1000))
  on conflict (user_id) do nothing;
  update public.kasyno_zetony set saldo = saldo + p_delta, updated_at = now()
  where user_id = p_user returning saldo into v_saldo;
  if v_saldo < 0 then
    raise exception 'Za malo zetonow';
  end if;
  return v_saldo;
end;
$$;
revoke execute on function public.zetony_zmien(uuid, integer) from public, anon, authenticated;

create function public.zetony_saldo(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select saldo from public.kasyno_zetony where user_id = p_user),
                  (select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_zetony_start'), 1000);
$$;
revoke execute on function public.zetony_saldo(uuid) from public, anon, authenticated;

-- Przechwycenie wpisów kasyna: w trybie żetonów nie trafiają do księgi punktów.
create function public.kasyno_do_zetonow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.category = 'kasyno' and public.kasyno_tryb_zetony() and new.user_id is not null then
    perform public.zetony_zmien(new.user_id, new.delta);
    return null;
  end if;
  return new;
end;
$$;
create trigger kasyno_do_zetonow before insert on public.points_ledger
  for each row execute function public.kasyno_do_zetonow();

-- Limit w trybie żetonów: obrót w oknie + saldo, czyli stawka <= saldo.
create or replace function public.limit_kasyna_dla(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team    uuid;
  v_ukryta  boolean;
  v_wynik   integer;
  v_teraz   integer;
  v_ludzi   integer;
  v_procent numeric;
  v_minimum integer;
begin
  if public.kasyno_tryb_zetony() then
    return (select coalesce(sum(stake), 0)::integer from public.game_sessions
            where user_id = p_user and created_at >= public.poczatek_okna_kasyna())
           + public.zetony_saldo(p_user);
  end if;

  select p.team_id, t.ukryta into v_team, v_ukryta
  from public.profiles p
  left join public.teams t on t.id = p.team_id
  where p.id = p_user;

  if v_team is null then
    return 0;
  end if;

  if v_ukryta then
    return coalesce((select (value #>> '{}')::integer from public.app_settings
                     where key = 'casino_daily_stake_cap'), 300);
  end if;

  v_procent := coalesce((select (value #>> '{}')::numeric from public.app_settings
                         where key = 'kasyno_procent'), 25);
  v_minimum := coalesce((select (value #>> '{}')::integer from public.app_settings
                         where key = 'kasyno_minimum'), 0);

  select coalesce(sum(delta) filter (where created_at < public.poczatek_okna_kasyna()), 0)::integer,
         coalesce(sum(delta), 0)::integer
    into v_wynik, v_teraz
  from public.points_ledger
  where team_id = v_team;

  select count(*)::integer into v_ludzi
  from public.profiles
  where team_id = v_team and status = 'approved'::public.user_status;

  return greatest(
    floor(greatest(v_wynik, 0) * v_procent / 100.0 / greatest(v_ludzi, 1))::integer,
    least(v_minimum, floor(greatest(v_teraz, 0) / greatest(v_ludzi, 1)::numeric)::integer)
  );
end;
$$;
revoke execute on function public.limit_kasyna_dla(uuid) from public, anon, authenticated;

-- Stan dla ekranu kasyna: tryb, saldo, dokładki, jackpot.
create function public.moje_zetony()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tryb', public.kasyno_tryb_zetony(),
    'saldo', public.zetony_saldo(auth.uid()),
    'dokladki', coalesce((select dokladki from public.kasyno_zetony where user_id = auth.uid()), 0),
    'start', coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_zetony_start'), 1000),
    'jackpot', (select kwota from public.kasyno_jackpot)
  );
$$;
revoke execute on function public.moje_zetony() from public, anon;
grant execute on function public.moje_zetony() to authenticated;

-- Dokładka: tylko gdy nie stać na najmniejszą stawkę (10); liczy się w rankingu.
create function public.dokladka_zetonow()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_start integer; v_saldo integer;
begin
  if not public.is_approved() or not public.kasyno_tryb_zetony() then
    raise exception 'Dokladka niedostepna';
  end if;
  v_saldo := public.zetony_saldo(auth.uid());
  if v_saldo >= 10 then
    raise exception 'Masz jeszcze zetony na gre';
  end if;
  v_start := coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_zetony_start'), 1000);
  perform public.zetony_zmien(auth.uid(), 0);
  update public.kasyno_zetony set saldo = v_start, dokladki = dokladki + 1, updated_at = now()
  where user_id = auth.uid();
  return v_start;
end;
$$;
revoke execute on function public.dokladka_zetonow() from public, anon;
grant execute on function public.dokladka_zetonow() to authenticated;

-- Król Kasyna: bilans = saldo - start × dokładki (dokładka to pożyczka, nie wygrana).
create function public.krol_kasyna()
returns table (user_id uuid, imie text, druzyna text, kolor text, saldo integer, dokladki integer, bilans integer)
language sql stable security definer set search_path = '' as $$
  select z.user_id, p.display_name, t.name, t.color, z.saldo, z.dokladki,
         z.saldo - z.dokladki * coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_zetony_start'), 1000)
  from public.kasyno_zetony z
  join public.profiles p on p.id = z.user_id
  left join public.teams t on t.id = p.team_id
  where public.is_approved() or public.is_admin()
  order by 7 desc, z.updated_at
  limit 50;
$$;
revoke execute on function public.krol_kasyna() from public, anon;
grant execute on function public.krol_kasyna() to authenticated;

-- ---------- jackpot ----------
create function public.kasyno_jackpot_spin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kwota integer;
  v_imie  text;
begin
  if new.game <> 'sloty' or not public.kasyno_tryb_zetony() then
    return null;
  end if;
  update public.kasyno_jackpot
  set kwota = kwota + coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_jackpot_wplata'), 2)
  where id
  returning kwota into v_kwota;

  if new.state -> 'bebny' = '["oko", "oko", "oko"]'::jsonb then
    perform public.zetony_zmien(new.user_id, v_kwota);
    update public.kasyno_jackpot
    set kwota = coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'kasyno_jackpot_start'), 500),
        ostatni_zwyciezca = new.user_id, ostatnia_wygrana = v_kwota, ostatnio_at = now()
    where id;
    select coalesce(display_name, 'Ktoś') into v_imie from public.profiles where id = new.user_id;
    insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
    values ('push', 'all', 'JACKPOT!', v_imie || ' trafia trzy Oka i zgarnia ' || v_kwota || ' żetonów z jackpotu',
            '/app/arcade/sloty', 'jackpot', new.id::text);
  end if;
  return null;
end;
$$;
create trigger kasyno_jackpot_spin after insert on public.game_sessions
  for each row execute function public.kasyno_jackpot_spin();

-- ---------- wyzwania 1 na 1 ----------
create function public.wyzwij(p_do uuid, p_stawka integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_imie text;
begin
  if not public.is_approved() or not public.kasyno_tryb_zetony() then
    raise exception 'Wyzwania niedostepne';
  end if;
  if p_do = auth.uid() then
    raise exception 'Nie mozesz wyzwac samego siebie';
  end if;
  if not exists (select 1 from public.profiles where id = p_do and status = 'approved'::public.user_status) then
    raise exception 'Nie ma takiego gracza';
  end if;
  if p_stawka is null or p_stawka < 10 or p_stawka > 500 then
    raise exception 'Stawka od 10 do 500 zetonow';
  end if;
  if (select count(*) from public.kasyno_wyzwania where od = auth.uid() and status = 'czeka') >= 3 then
    raise exception 'Masz juz 3 wyzwania bez odpowiedzi';
  end if;
  -- Stawka wyzywającego od razu idzie do puli (zwrot przy odrzuceniu/anulowaniu).
  perform public.zetony_zmien(auth.uid(), -p_stawka);
  insert into public.kasyno_wyzwania (od, do_kogo, stawka) values (auth.uid(), p_do, p_stawka) returning id into v_id;
  select coalesce(display_name, 'Ktoś') into v_imie from public.profiles where id = auth.uid();
  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'user', p_do, 'Wyzwanie w kasynie!', v_imie || ' wyzywa Cię na pojedynek kart o ' || p_stawka || ' żetonów',
          '/app/arcade/wyzwania', 'wyzwanie', v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.wyzwij(uuid, integer) from public, anon;
grant execute on function public.wyzwij(uuid, integer) to authenticated;

/** Rdzeń pojedynku z podaną talią (testy) - po dwie karty, bliżej 21 wygrywa. */
create function public.wyzwanie_rozegraj(p_id uuid, p_talia text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w public.kasyno_wyzwania%rowtype;
  v_od text[]; v_do text[]; v_a integer; v_b integer; v_zw uuid;
  v_imie_od text; v_imie_do text; v_tekst text;
begin
  select * into w from public.kasyno_wyzwania where id = p_id for update;
  if not found or w.status <> 'czeka' then
    raise exception 'Wyzwanie juz nieaktualne';
  end if;
  perform public.zetony_zmien(w.do_kogo, -w.stawka);
  v_od := array[p_talia[1], p_talia[3]];
  v_do := array[p_talia[2], p_talia[4]];
  v_a := public.bj_wartosc(v_od);
  v_b := public.bj_wartosc(v_do);
  if v_a > v_b then v_zw := w.od; elsif v_b > v_a then v_zw := w.do_kogo; end if;
  if v_zw is null then
    perform public.zetony_zmien(w.od, w.stawka);
    perform public.zetony_zmien(w.do_kogo, w.stawka);
  else
    perform public.zetony_zmien(v_zw, w.stawka * 2);
  end if;
  update public.kasyno_wyzwania
  set status = 'rozegrane', karty_od = v_od, karty_do = v_do, zwyciezca = v_zw, rozegrane_at = now()
  where id = p_id;

  select coalesce(display_name, 'Ktoś') into v_imie_od from public.profiles where id = w.od;
  select coalesce(display_name, 'Ktoś') into v_imie_do from public.profiles where id = w.do_kogo;
  v_tekst := v_imie_od || ' ' || v_a || ' : ' || v_b || ' ' || v_imie_do || ' - ' ||
    case when v_zw is null then 'remis, stawki wracają'
         when v_zw = w.od then v_imie_od || ' zgarnia ' || w.stawka * 2 || ' żetonów'
         else v_imie_do || ' zgarnia ' || w.stawka * 2 || ' żetonów' end;
  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'user', w.od, 'Pojedynek rozegrany', v_tekst, '/app/arcade/wyzwania', 'wyzwanie', w.id::text);
  return jsonb_build_object('karty_od', to_jsonb(v_od), 'karty_do', to_jsonb(v_do), 'punkty_od', v_a, 'punkty_do', v_b, 'zwyciezca', v_zw);
end;
$$;
revoke execute on function public.wyzwanie_rozegraj(uuid, text[]) from public, anon, authenticated;

create function public.przyjmij_wyzwanie(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.kasyno_wyzwania where id = p_id and do_kogo = auth.uid() and status = 'czeka') then
    raise exception 'To wyzwanie nie czeka na Ciebie';
  end if;
  if public.zetony_saldo(auth.uid()) < (select stawka from public.kasyno_wyzwania where id = p_id) then
    raise exception 'Za malo zetonow na to wyzwanie';
  end if;
  return public.wyzwanie_rozegraj(p_id, public.bj_potasuj());
end;
$$;
revoke execute on function public.przyjmij_wyzwanie(uuid) from public, anon;
grant execute on function public.przyjmij_wyzwanie(uuid) to authenticated;

/** Odrzucenie (wyzwany) albo anulowanie (wyzywający): stawka wraca do wyzywającego. */
create function public.zamknij_wyzwanie(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare w public.kasyno_wyzwania%rowtype;
begin
  select * into w from public.kasyno_wyzwania where id = p_id for update;
  if not found or w.status <> 'czeka' or auth.uid() not in (w.od, w.do_kogo) then
    raise exception 'Nie mozna zamknac tego wyzwania';
  end if;
  perform public.zetony_zmien(w.od, w.stawka);
  update public.kasyno_wyzwania
  set status = case when auth.uid() = w.od then 'anulowane' else 'odrzucone' end
  where id = p_id;
end;
$$;
revoke execute on function public.zamknij_wyzwanie(uuid) from public, anon;
grant execute on function public.zamknij_wyzwanie(uuid) to authenticated;

/** Lista wyzwań z imionami - ekran Wyzwań. */
create function public.moje_wyzwania()
returns table (id uuid, od uuid, od_imie text, do_kogo uuid, do_imie text, stawka integer, status text,
               karty_od text[], karty_do text[], zwyciezca uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.id, w.od, po.display_name, w.do_kogo, pd.display_name, w.stawka, w.status,
         w.karty_od, w.karty_do, w.zwyciezca, w.created_at
  from public.kasyno_wyzwania w
  join public.profiles po on po.id = w.od
  join public.profiles pd on pd.id = w.do_kogo
  where auth.uid() in (w.od, w.do_kogo)
  order by (w.status = 'czeka') desc, w.created_at desc
  limit 30;
$$;
revoke execute on function public.moje_wyzwania() from public, anon;
grant execute on function public.moje_wyzwania() to authenticated;

/** Kogo można wyzwać: przyjęci uczestnicy (bez siebie). */
create function public.gracze_do_wyzwania()
returns table (id uuid, imie text, druzyna text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, t.name
  from public.profiles p left join public.teams t on t.id = p.team_id
  where p.status = 'approved'::public.user_status and p.id <> auth.uid() and p.display_name is not null
    and public.is_approved()
  order by p.display_name;
$$;
revoke execute on function public.gracze_do_wyzwania() from public, anon;
grant execute on function public.gracze_do_wyzwania() to authenticated;
