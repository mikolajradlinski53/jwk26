-- ============================================================
-- Sekta Wyjazdowa — spin
-- ============================================================
--
-- Wszystko w jednej transakcji: uprawnienia, blokada, limit obrotu, saldo,
-- losowanie, wycena, zapis sesji, wpis do księgi. Rozbicie na osobne wywołania
-- pozwoliłoby zagrać dwa razy za te same punkty.
--
-- Funkcja **nie przyjmuje stawki** (D2). To najtańsze zamknięcie najtańszego
-- oszustwa: parametr trzeba by walidować na zakres, typ i znak, a każde takie
-- sprawdzenie to miejsce na pomyłkę. Brak parametru nie ma jak być zwalidowany źle.

-- ---------- Okno doby ----------
-- Ruchome 24 godziny, nie doba kalendarzowa. Czas letni kończy się 25 października
-- 2026 — w ostatnią noc wyjazdu — więc doba kalendarzowa ma wtedy 25 godzin,
-- a godzina 2:00 zdarza się dwa razy. Czas absolutny jest na to odporny, a przy
-- okazji nie da się limitu grać czekaniem do północy.
--
-- Suma po wszystkich grach, nie tylko slotach: gdy dojdzie blackjack, limit ma
-- być wspólny i nie trzeba go dzielić.
--
-- Osobna funkcja, bo tę samą liczbę **pokazuje ekran i wymusza spin**. Powtórzone
-- zapytanie w dwóch miejscach znaczyłoby, że gracz może widzieć inny limit niż
-- ten, który go blokuje. Prawami wywołującego, nie definiującego: polityka RLS
-- przepuszcza własne wiersze, a `stake` jest w grancie kolumnowym.
create function public.obrot_w_oknie()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(stake), 0)::integer
  from public.game_sessions
  where user_id = auth.uid()
    and created_at > now() - interval '24 hours';
$$;

revoke execute on function public.obrot_w_oknie() from anon, public;
grant  execute on function public.obrot_w_oknie() to authenticated;

create function public.zakrec_slotami()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_team    uuid;
  v_stawka  integer;
  v_limit   integer;
  v_obrot   integer;
  v_saldo   integer;
  v_bebny   text[];
  v_wyplata integer;
  v_netto   integer;
  v_id      uuid;
begin
  -- SECURITY DEFINER omija RLS, więc uprawnienie sprawdzamy ręcznie. Bez tego
  -- zakręciłby każdy zalogowany, także ktoś ze statusem 'pending'.
  if not public.is_approved() then
    raise exception 'Tylko zaakceptowani uczestnicy moga grac';
  end if;

  -- Blokada wiersza gracza. Saldo indywidualne to SUM(delta) z księgi, a nie
  -- kolumna, więc nie ma czego zablokować — blokujemy wiersz profilu jako zamek
  -- na to saldo. Ten sam idiom rozbraja wyścig zakupów w sklepiku.
  select team_id into v_team
  from public.profiles where id = v_user for update;

  -- Księga wymaga team_id, więc gracz bez drużyny nie ma gdzie zapisać wyniku.
  if v_team is null then
    raise exception 'Nie nalezysz do zadnej druzyny';
  end if;

  select (value #>> '{}')::integer into v_stawka
  from public.app_settings where key = 'slots_stawka';
  select (value #>> '{}')::integer into v_limit
  from public.app_settings where key = 'casino_daily_stake_cap';

  v_obrot := public.obrot_w_oknie();

  -- Odbijamy spin, zamiast go przycinać: częściowy spin nie istnieje.
  if v_obrot + v_stawka > v_limit then
    raise exception 'Limit obrotu wyczerpany: % z % punktow w ostatnich 24 h',
      v_obrot, v_limit;
  end if;

  select coalesce(sum(delta), 0)::integer into v_saldo
  from public.points_ledger where user_id = v_user;

  if v_saldo < v_stawka then
    raise exception 'Masz % pkt, a stawka to %', v_saldo, v_stawka;
  end if;

  v_bebny   := public.losuj_bebny();
  v_wyplata := public.rozstrzygnij_bebny(v_bebny);
  v_netto   := v_wyplata - v_stawka;

  insert into public.game_sessions (user_id, game, stake, payout, state, status)
  values (v_user, 'sloty', v_stawka, v_wyplata,
          jsonb_build_object('bebny', to_jsonb(v_bebny)), 'settled')
  returning id into v_id;

  -- Jeden wpis netto, i tylko niezerowy (D4). Szacunek, który o tym zdecydował:
  -- 60 osób × 30 spinów × 3 dni to 5400 spinów, czyli przy dwóch wpisach na spin
  -- 10 800 wierszy, które zatopiłyby /app/admin/historia dokładnie wtedy, kiedy
  -- będzie potrzebna. Stawka i wypłata z osobna zostają w game_sessions.
  if v_netto <> 0 then
    insert into public.points_ledger
      (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
    values
      (v_user, v_team, v_netto, 'kasyno',
       'Sloty: ' || array_to_string(v_bebny, ' '), 'slot_spin', v_id::text, v_user);
  end if;

  return jsonb_build_object(
    'bebny',   to_jsonb(v_bebny),
    'wyplata', v_wyplata,
    'netto',   v_netto,
    'obrot',   v_obrot + v_stawka,
    'limit',   v_limit
  );
end;
$$;

revoke execute on function public.zakrec_slotami() from anon, public;
grant  execute on function public.zakrec_slotami() to authenticated;
