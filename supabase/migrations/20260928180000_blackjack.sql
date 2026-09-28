-- ============================================================
-- Sekta Wyjazdowa — blackjack
-- ============================================================
--
-- Mapa mechanizmów, plan 13. Dobierz / stań / podwój, krupier staje na 17,
-- blackjack z rozdania płaci 3:2, stawka 10, 20 albo 50, limit obrotu wspólny
-- ze slotami (obie gry piszą `stake` do game_sessions).
--
-- Talia żyje w `game_sessions.state`, którego gracz nie może czytać od
-- pierwszego dnia kasyna (grant kolumnowy). Gracz dostaje wyłącznie widok:
-- swoje karty i odkrytą kartę krupiera.
--
-- Stawka schodzi z salda PRZY ROZDANIU (osobny wpis w księdze), wypłata
-- wraca przy rozstrzygnięciu. Inaczej w trakcie ręki dałoby się przegrać te
-- same punkty w slotach, a rozliczenie ręki zepchnęłoby saldo pod zero.
--
-- Rdzeń (bj_start, bj_ruch) przyjmuje użytkownika i — w bj_start — talię.
-- Dzięki temu logikę da się przetestować na ustalonych kartach. Rdzeń jest
-- wyłącznie dla klucza serwisowego; gracz woła opakowania, które same biorą
-- auth.uid() i tasują talię w bazie. Gracz nigdy nie wybiera kart.

-- Jedna ręka w toku na osobę — indeks, nie tylko sprawdzenie w funkcji.
create unique index game_sessions_jedna_reka_bj
  on game_sessions (user_id)
  where game = 'blackjack' and status = 'open';

-- ---------- Karty ----------
-- Karta to ranga + kolor: '10h', 'As', 'Kd'. Asy liczą się jako 11, dopóki
-- ręka nie przekroczy 21 — wtedy kolejno jako 1.
create function public.bj_wartosc(p_karty text[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_suma  integer := 0;
  v_asy   integer := 0;
  v_karta text;
  v_ranga text;
begin
  foreach v_karta in array coalesce(p_karty, '{}') loop
    v_ranga := left(v_karta, length(v_karta) - 1);
    if v_ranga = 'A' then
      v_asy := v_asy + 1;
      v_suma := v_suma + 11;
    elsif v_ranga in ('K', 'Q', 'J') then
      v_suma := v_suma + 10;
    else
      v_suma := v_suma + v_ranga::integer;
    end if;
  end loop;

  while v_suma > 21 and v_asy > 0 loop
    v_suma := v_suma - 10;
    v_asy := v_asy - 1;
  end loop;

  return v_suma;
end;
$$;

-- Jedna świeża talia na rękę, tasowana w bazie.
create function public.bj_potasuj()
returns text[]
language sql
volatile
set search_path = ''
as $$
  select array_agg(r || s order by random())
  from unnest(array['2','3','4','5','6','7','8','9','10','J','Q','K','A']) as r
  cross join unnest(array['s','h','d','c']) as s;
$$;

create function public.bj_karty(p_state jsonb, p_klucz text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(select jsonb_array_elements_text(p_state -> p_klucz)), '{}');
$$;

-- ---------- Widok dla gracza ----------
-- Jedyna postać ręki, która wychodzi do przeglądarki. Bez talii; w trakcie
-- ręki bez drugiej karty krupiera i bez jego punktów.
create function public.bj_widok(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s         public.game_sessions%rowtype;
  v_gracz   text[];
  v_krupier text[];
  v_otwarta boolean;
begin
  select * into s from public.game_sessions where id = p_id;
  if not found then
    return null;
  end if;

  v_gracz := public.bj_karty(s.state, 'gracz');
  v_krupier := public.bj_karty(s.state, 'krupier');
  v_otwarta := s.status = 'open';

  return jsonb_build_object(
    'id', s.id,
    'stawka', s.stake,
    'status', s.status,
    'gracz', to_jsonb(v_gracz),
    'krupier', case when v_otwarta then to_jsonb(v_krupier[1:1]) else to_jsonb(v_krupier) end,
    'punkty_gracza', public.bj_wartosc(v_gracz),
    'punkty_krupiera', case when v_otwarta then null else public.bj_wartosc(v_krupier) end,
    'wynik', s.state ->> 'wynik',
    'wyplata', case when v_otwarta then null else s.payout end,
    'mozna_podwoic', v_otwarta and cardinality(v_gracz) = 2
  );
end;
$$;

-- ---------- Rozstrzygnięcie ----------
create function public.bj_rozstrzygnij(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s          public.game_sessions%rowtype;
  v_talia    text[];
  v_gracz    text[];
  v_krupier  text[];
  v_g        integer;
  v_d        integer;
  v_bj_g     boolean;
  v_bj_k     boolean;
  v_wynik    text;
  v_wyplata  integer;
  v_team     uuid;
begin
  select * into s from public.game_sessions where id = p_id for update;
  if not found or s.status <> 'open' then
    return;
  end if;

  v_talia := public.bj_karty(s.state, 'talia');
  v_gracz := public.bj_karty(s.state, 'gracz');
  v_krupier := public.bj_karty(s.state, 'krupier');

  v_g := public.bj_wartosc(v_gracz);
  v_bj_g := cardinality(v_gracz) = 2 and v_g = 21
            and not coalesce((s.state ->> 'podwojone')::boolean, false);
  v_bj_k := cardinality(v_krupier) = 2 and public.bj_wartosc(v_krupier) = 21;

  if v_g > 21 then
    v_wynik := 'fura';
    v_wyplata := 0;
  elsif v_bj_g and not v_bj_k then
    -- 3:2 — przy stawkach 10, 20, 50 zawsze pełne punkty (25, 50, 125).
    v_wynik := 'blackjack';
    v_wyplata := (s.stake * 5) / 2;
  elsif v_bj_k and not v_bj_g then
    v_wynik := 'przegrana';
    v_wyplata := 0;
  elsif v_bj_g and v_bj_k then
    v_wynik := 'remis';
    v_wyplata := s.stake;
  else
    -- Krupier staje na każdych 17, także „miękkich" z asem.
    while public.bj_wartosc(v_krupier) < 17 loop
      v_krupier := v_krupier || v_talia[1];
      v_talia := v_talia[2:];
    end loop;
    v_d := public.bj_wartosc(v_krupier);

    if v_d > 21 or v_g > v_d then
      v_wynik := 'wygrana';
      v_wyplata := s.stake * 2;
    elsif v_g = v_d then
      v_wynik := 'remis';
      v_wyplata := s.stake;
    else
      v_wynik := 'przegrana';
      v_wyplata := 0;
    end if;
  end if;

  update public.game_sessions
  set status = 'settled',
      payout = v_wyplata,
      state = s.state
        || jsonb_build_object('talia', to_jsonb(v_talia), 'krupier', to_jsonb(v_krupier), 'wynik', v_wynik)
  where id = p_id;

  if v_wyplata > 0 then
    select team_id into v_team from public.profiles where id = s.user_id;
    insert into public.points_ledger
      (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
    values
      (s.user_id, v_team, v_wyplata, 'kasyno', 'Blackjack: ' || v_wynik, 'blackjack', s.id::text, s.user_id);
  end if;
end;
$$;

-- ---------- Wspólne sprawdzenia stawki ----------
-- Limit obrotu i saldo przy rozdaniu i przy podwojeniu. Wywołujący trzyma
-- blokadę wiersza profiles — ten sam zamek na saldo co w slotach i sklepiku.
create function public.bj_sprawdz_stawke(p_user uuid, p_stawka integer)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_obrot integer;
  v_saldo integer;
begin
  select (value #>> '{}')::integer into v_limit
  from public.app_settings where key = 'casino_daily_stake_cap';

  select coalesce(sum(stake), 0)::integer into v_obrot
  from public.game_sessions
  where user_id = p_user and created_at > now() - interval '24 hours';

  if v_obrot + p_stawka > v_limit then
    raise exception 'Limit obrotu wyczerpany: % z % punktow w ostatnich 24 h', v_obrot, v_limit;
  end if;

  select coalesce(sum(delta), 0)::integer into v_saldo
  from public.points_ledger where user_id = p_user;

  if v_saldo < p_stawka then
    raise exception 'Masz % pkt, a stawka to %', v_saldo, p_stawka;
  end if;
end;
$$;

-- ---------- Rdzeń: rozdanie ----------
create function public.bj_start(p_user uuid, p_stawka integer, p_talia text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team    uuid;
  v_status  public.user_status;
  v_id      uuid;
  v_gracz   text[];
  v_krupier text[];
begin
  if p_stawka is null or p_stawka not in (10, 20, 50) then
    raise exception 'Stawka to 10, 20 albo 50 pkt';
  end if;

  select team_id, status into v_team, v_status
  from public.profiles where id = p_user for update;

  if v_status is distinct from 'approved'::public.user_status then
    raise exception 'Tylko zaakceptowani uczestnicy moga grac';
  end if;
  if v_team is null then
    raise exception 'Nie nalezysz do zadnej druzyny';
  end if;

  if exists (
    select 1 from public.game_sessions
    where user_id = p_user and game = 'blackjack' and status = 'open'
  ) then
    raise exception 'Masz reke w toku — dokoncz ja';
  end if;

  if cardinality(p_talia) < 10 then
    raise exception 'Za krotka talia';
  end if;

  perform public.bj_sprawdz_stawke(p_user, p_stawka);

  v_gracz := array[p_talia[1], p_talia[3]];
  v_krupier := array[p_talia[2], p_talia[4]];

  insert into public.game_sessions (user_id, game, stake, payout, status, state)
  values (p_user, 'blackjack', p_stawka, 0, 'open', jsonb_build_object(
    'talia', to_jsonb(p_talia[5:]),
    'gracz', to_jsonb(v_gracz),
    'krupier', to_jsonb(v_krupier),
    'wynik', null,
    'podwojone', false
  ))
  returning id into v_id;

  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
  values
    (p_user, v_team, -p_stawka, 'kasyno', 'Blackjack: stawka', 'blackjack', v_id::text, p_user);

  -- Blackjack gracza albo krupiera z rozdania kończy rękę od razu.
  if public.bj_wartosc(v_gracz) = 21 or public.bj_wartosc(v_krupier) = 21 then
    perform public.bj_rozstrzygnij(v_id);
  end if;

  return public.bj_widok(v_id);
end;
$$;

-- ---------- Rdzeń: ruch ----------
create function public.bj_ruch(p_user uuid, p_ruch text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s        public.game_sessions%rowtype;
  v_team   uuid;
  v_talia  text[];
  v_gracz  text[];
begin
  -- Najpierw profil, potem ręka — ta sama kolejność blokad co w bj_start.
  select team_id into v_team from public.profiles where id = p_user for update;

  select * into s from public.game_sessions
  where user_id = p_user and game = 'blackjack' and status = 'open'
  for update;
  if not found then
    raise exception 'Brak reki w toku';
  end if;

  v_talia := public.bj_karty(s.state, 'talia');
  v_gracz := public.bj_karty(s.state, 'gracz');

  if p_ruch = 'dobierz' then
    v_gracz := v_gracz || v_talia[1];
    update public.game_sessions
    set state = s.state || jsonb_build_object('talia', to_jsonb(v_talia[2:]), 'gracz', to_jsonb(v_gracz))
    where id = s.id;
    -- 21 kończy rękę jak stanie — dalsze dobieranie nie ma sensu.
    if public.bj_wartosc(v_gracz) >= 21 then
      perform public.bj_rozstrzygnij(s.id);
    end if;

  elsif p_ruch = 'stan' then
    perform public.bj_rozstrzygnij(s.id);

  elsif p_ruch = 'podwoj' then
    if cardinality(v_gracz) <> 2 then
      raise exception 'Podwoic mozna tylko na dwoch pierwszych kartach';
    end if;
    perform public.bj_sprawdz_stawke(p_user, s.stake);

    insert into public.points_ledger
      (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
    values
      (p_user, v_team, -s.stake, 'kasyno', 'Blackjack: podwojenie', 'blackjack', s.id::text, p_user);

    v_gracz := v_gracz || v_talia[1];
    update public.game_sessions
    set stake = s.stake * 2,
        state = s.state || jsonb_build_object(
          'talia', to_jsonb(v_talia[2:]), 'gracz', to_jsonb(v_gracz), 'podwojone', true)
    where id = s.id;
    perform public.bj_rozstrzygnij(s.id);

  else
    raise exception 'Nieznany ruch';
  end if;

  return public.bj_widok(s.id);
end;
$$;

-- ---------- Porzucone ręce ----------
-- Co minutę z pg_cron: ręka otwarta dłużej niż 10 minut rozstrzyga się jak
-- „stań", żeby stawka nie wisiała bez końca, a gracz mógł rozdać nową.
create function public.bj_porzucone()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_ile   integer := 0;
begin
  for v_id in
    select id from public.game_sessions
    where game = 'blackjack' and status = 'open'
      and created_at < now() - interval '10 minutes'
  loop
    perform public.bj_rozstrzygnij(v_id);
    v_ile := v_ile + 1;
  end loop;
  return v_ile;
end;
$$;

select cron.schedule('blackjack-porzucone', '* * * * *', 'select public.bj_porzucone()');

-- ---------- Opakowania dla gracza ----------
create function public.blackjack_rozdaj(p_stawka integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  return public.bj_start(auth.uid(), p_stawka, public.bj_potasuj());
end;
$$;

create function public.blackjack_ruch(p_ruch text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  return public.bj_ruch(auth.uid(), p_ruch);
end;
$$;

create function public.blackjack_stan()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.bj_widok(id)
  from public.game_sessions
  where user_id = auth.uid() and game = 'blackjack' and status = 'open';
$$;

-- ---------- Historia ----------
-- Jak moje_spiny: prawami właściciela, więc warunek user_id = auth.uid()
-- w ciele widoku jest całą ochroną. Tylko rozstrzygnięte ręce — talia z nich
-- nie wychodzi, a karty są już jawne.
create view moje_rozdania as
  select id,
         stake,
         payout,
         created_at,
         state -> 'gracz'   as gracz,
         state -> 'krupier' as krupier,
         state ->> 'wynik'  as wynik
  from game_sessions
  where user_id = auth.uid()
    and game = 'blackjack'
    and status = 'settled';

grant select on moje_rozdania to authenticated;

-- ---------- Uprawnienia ----------
revoke execute on function public.bj_wartosc(text[]) from public, anon;
grant  execute on function public.bj_wartosc(text[]) to authenticated;

revoke execute on function public.bj_potasuj() from public, anon, authenticated;
revoke execute on function public.bj_karty(jsonb, text) from public, anon, authenticated;
revoke execute on function public.bj_widok(uuid) from public, anon, authenticated;
revoke execute on function public.bj_rozstrzygnij(uuid) from public, anon, authenticated;
revoke execute on function public.bj_sprawdz_stawke(uuid, integer) from public, anon, authenticated;

-- Rdzeń: wyłącznie klucz serwisowy (testy) i pg_cron.
revoke execute on function public.bj_start(uuid, integer, text[]) from public, anon, authenticated;
grant  execute on function public.bj_start(uuid, integer, text[]) to service_role;
revoke execute on function public.bj_ruch(uuid, text) from public, anon, authenticated;
grant  execute on function public.bj_ruch(uuid, text) to service_role;
revoke execute on function public.bj_porzucone() from public, anon, authenticated;
grant  execute on function public.bj_porzucone() to service_role;

revoke execute on function public.blackjack_rozdaj(integer) from public, anon;
grant  execute on function public.blackjack_rozdaj(integer) to authenticated;
revoke execute on function public.blackjack_ruch(text) from public, anon;
grant  execute on function public.blackjack_ruch(text) to authenticated;
revoke execute on function public.blackjack_stan() from public, anon;
grant  execute on function public.blackjack_stan() to authenticated;
