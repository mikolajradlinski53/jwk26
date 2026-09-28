-- ============================================================
-- Sekta Wyjazdowa — blackjack: większa przewaga kasyna
-- ============================================================
--
-- Po pierwszych grach (2026-09-28): gra była zbyt łaskawa dla gracza —
-- pojedyncza talia, S17 i 3:2 to przewaga kasyna bliska zera. Trzy zmiany,
-- razem ok. 2% na korzyść kasyna, bez zamieniania remisów w przegrane:
--   1. blackjack płaci 6:5 zamiast 3:2 (stawka 10 → wypłata 22);
--   2. krupier dobiera na miękkie 17 (as liczony jako 11);
--   3. podwojenie wyłącznie przy 9, 10 albo 11 na dwóch pierwszych kartach.

-- Miękka ręka: as liczony jako 11 bez przekroczenia 21.
create function public.bj_miekka(p_karty text[])
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_twarda integer := 0;
  v_as     boolean := false;
  v_karta  text;
  v_ranga  text;
begin
  foreach v_karta in array coalesce(p_karty, '{}') loop
    v_ranga := left(v_karta, length(v_karta) - 1);
    if v_ranga = 'A' then
      v_as := true;
      v_twarda := v_twarda + 1;
    elsif v_ranga in ('K', 'Q', 'J') then
      v_twarda := v_twarda + 10;
    else
      v_twarda := v_twarda + v_ranga::integer;
    end if;
  end loop;
  return v_as and v_twarda + 10 <= 21;
end;
$$;

revoke execute on function public.bj_miekka(text[]) from public, anon, authenticated;

-- Czy wolno podwoić — jedno miejsce dla widoku i dla ruchu.
create function public.bj_mozna_podwoic(p_karty text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_karty) = 2 and public.bj_wartosc(p_karty) between 9 and 11;
$$;

revoke execute on function public.bj_mozna_podwoic(text[]) from public, anon, authenticated;

-- ---------- Widok ----------
create or replace function public.bj_widok(p_id uuid)
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
    'mozna_podwoic', v_otwarta and public.bj_mozna_podwoic(v_gracz)
  );
end;
$$;

-- ---------- Rozstrzygnięcie ----------
create or replace function public.bj_rozstrzygnij(p_id uuid)
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
    -- 6:5 — przy stawkach 10, 20, 50 zawsze pełne punkty (22, 44, 110).
    v_wynik := 'blackjack';
    v_wyplata := (s.stake * 11) / 5;
  elsif v_bj_k and not v_bj_g then
    v_wynik := 'przegrana';
    v_wyplata := 0;
  elsif v_bj_g and v_bj_k then
    v_wynik := 'remis';
    v_wyplata := s.stake;
  else
    -- Krupier dobiera poniżej 17 oraz na miękkie 17 (H17).
    while public.bj_wartosc(v_krupier) < 17
          or (public.bj_wartosc(v_krupier) = 17 and public.bj_miekka(v_krupier)) loop
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

-- ---------- Ruch ----------
create or replace function public.bj_ruch(p_user uuid, p_ruch text)
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
    if public.bj_wartosc(v_gracz) >= 21 then
      perform public.bj_rozstrzygnij(s.id);
    end if;

  elsif p_ruch = 'stan' then
    perform public.bj_rozstrzygnij(s.id);

  elsif p_ruch = 'podwoj' then
    if not public.bj_mozna_podwoic(v_gracz) then
      raise exception 'Podwoic mozna tylko przy 9, 10 albo 11 na dwoch pierwszych kartach';
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
