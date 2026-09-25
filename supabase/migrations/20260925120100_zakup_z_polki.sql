-- ============================================================
-- Sekta Wyjazdowa — zakup z półki
-- ============================================================
--
-- Wszystko w jednej transakcji: sprawdzenie uprawnień, salda i stanu, wpis do
-- księgi, zamówienie, zmniejszenie stanu, wykonanie efektu, wiersz w outboxie.
-- Rozbicie na osobne wywołania pozwoliłoby kupić dwa razy za te same punkty.
create function public.kup_z_polki(
  p_item_id     uuid,
  p_target_team uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team     uuid;
  v_nazwa    text;
  v_item     public.shop_items;
  v_saldo    integer;
  v_order    uuid;
  v_note     text := null;
  v_tarcza   uuid;
  v_expires  timestamptz := null;
  v_blokada  uuid;
begin
  -- SECURITY DEFINER omija RLS, więc każde uprawnienie sprawdzamy ręcznie.
  -- Bez tych trzech warunków kupowałby każdy, kto umie otworzyć konsolę.
  if not public.is_approved() then
    raise exception 'Tylko zaakceptowani uczestnicy moga kupowac';
  end if;

  select team_id into v_team from public.profiles where id = auth.uid();
  if v_team is null then
    raise exception 'Nie nalezysz do zadnej druzyny';
  end if;

  if not public.is_captain(v_team) then
    raise exception 'Kupuje wylacznie kapitan druzyny';
  end if;

  -- ---------- Blokady ----------
  -- Salda nie da się zablokować, bo to SUM(delta) z księgi, a nie kolumna.
  -- Blokujemy więc wiersz drużyny jako zamek na jej saldo. Gdy w grę wchodzi
  -- druga drużyna (klątwa), blokujemy oba wiersze **w kolejności po id**: bez
  -- ustalonego porządku dwie wzajemne klątwy w tej samej sekundzie zablokowałyby
  -- wiersze odwrotnie i weszły w deadlock.
  --
  -- Pętla, a nie `... where id in (...) order by id for update`: przy FOR UPDATE
  -- z ORDER BY kolejność blokowania zależy od planu zapytania, a tu ma być
  -- gwarantowana.
  for v_blokada in
    select id from public.teams
    where id = v_team or id = p_target_team
    order by id
  loop
    perform 1 from public.teams where id = v_blokada for update;
  end loop;

  select name into v_nazwa from public.teams where id = v_team;

  -- ---------- Pozycja ----------
  -- Blokada wiersza pozycji: bez niej ostatnia sztuka sprzeda się dwa razy.
  select * into v_item from public.shop_items where id = p_item_id for update;
  if v_item.id is null then
    raise exception 'Nie ma takiej pozycji na polce';
  end if;
  if not v_item.active then
    raise exception 'Ta pozycja jest niedostepna';
  end if;
  if v_item.stock is not null and v_item.stock <= 0 then
    raise exception 'Ostatnia sztuka juz poszla';
  end if;

  -- ---------- Cel ----------
  if v_item.requires_target then
    if p_target_team is null then
      raise exception 'Ta pozycja wymaga wskazania druzyny';
    end if;
    if p_target_team = v_team then
      raise exception 'Nie mozna wskazac wlasnej druzyny';
    end if;
    if not exists (select 1 from public.teams where id = p_target_team) then
      raise exception 'Nie ma takiej druzyny';
    end if;
  elsif p_target_team is not null then
    raise exception 'Ta pozycja nie przyjmuje celu';
  end if;

  -- ---------- Saldo ----------
  select coalesce(sum(delta), 0)::integer into v_saldo
  from public.points_ledger where team_id = v_team;

  if v_saldo < v_item.price then
    raise exception 'Druzyna ma % pkt, a pozycja kosztuje %', v_saldo, v_item.price;
  end if;

  -- ---------- Zamówienie i księga ----------
  -- Zamówienie najpierw, bo wpis w księdze wskazuje na nie przez ref_id.
  insert into public.shop_orders
    (team_id, item_id, price_paid, ordered_by, target_team_id, status)
  values
    (v_team, p_item_id, v_item.price, auth.uid(), p_target_team, 'pending')
  returning id into v_order;

  -- user_id NULL: wydatek drużynowy nie obciąża indywidualnego wyniku kapitana.
  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
  values
    (null, v_team, -v_item.price, 'sklepik', v_item.name,
     'sklepik_zakup', v_order::text, auth.uid());

  if v_item.stock is not null then
    update public.shop_items set stock = stock - 1 where id = p_item_id;
  end if;

  -- ---------- Efekty cyfrowe ----------
  if v_item.kind = 'digital' then
    if v_item.effect_hours is not null then
      v_expires := now() + make_interval(hours => v_item.effect_hours);
    end if;

    if v_item.effect_key = 'klatwa' then
      -- Tarcza ofiary. Wiersz ofiary jest już zablokowany wyżej, więc dwie
      -- klątwy w tę samą drużynę nie zużyją jednej tarczy dwa razy.
      select id into v_tarcza
      from public.active_effects
      where scope = 'team'
        and subject_id = p_target_team
        and effect_key = 'tarcza'
        and consumed_at is null
        and (expires_at is null or expires_at > now())
      order by created_at
      limit 1
      for update skip locked;

      if v_tarcza is not null then
        update public.active_effects set consumed_at = now() where id = v_tarcza;
        v_note := 'Tarcza pochlonela rzut';
      else
        insert into public.points_ledger
          (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
        values
          (null, p_target_team, -v_item.effect_value, 'klatwa',
           'Klatwa od druzyny ' || v_nazwa, 'sklepik_klatwa', v_order::text, auth.uid());
      end if;
    else
      insert into public.active_effects
        (scope, subject_id, effect_key, effect_value, expires_at, order_id)
      values
        ('team', v_team, v_item.effect_key, v_item.effect_value, v_expires, v_order);
    end if;

    -- Efekt cyfrowy jest wykonany w tej samej transakcji, więc zamówienie nie
    -- czeka w kolejce. Kupujący traci punkty także wtedy, gdy tarcza pochłonęła
    -- rzut — za rozpoznanie, kto ma tarczę, płaci się z góry.
    update public.shop_orders
    set status = 'fulfilled', fulfilled_at = now(), note = v_note
    where id = v_order;
  end if;

  -- ---------- Outbox ----------
  insert into public.powiadomienia (adresat, tytul, body, ref_type, ref_id)
  values ('admin', 'Nowe zamowienie',
          v_item.name || ' — ' || v_nazwa, 'shop_order', v_order::text);

  -- Drugi wiersz, adresowany do ofiary, jest jedynym powodem, dla którego
  -- adresat ma wariant 'team'. Do czasu kroku 8 ofiara dowiaduje się z kroniki.
  if v_item.effect_key = 'klatwa' then
    insert into public.powiadomienia
      (adresat, adresat_id, tytul, body, ref_type, ref_id)
    values
      ('team', p_target_team, 'Klatwa',
       'Druzyna ' || v_nazwa || ' rzucila na was klatwe', 'shop_order', v_order::text);
  end if;

  return v_order;
end;
$$;

revoke execute on function public.kup_z_polki(uuid, uuid) from anon, public;
grant  execute on function public.kup_z_polki(uuid, uuid) to authenticated;
