-- ============================================================================
-- Licytacje (2026-10-22) - zamykanie, realizacja wygranej, Klątwa po wygranej
-- ============================================================================

-- ---------- Realizacja wygranej ----------
-- Jedna płatność w księdze i zamówienie jak przy dawnym zakupie z półki.
-- Efekt cyfrowy (Błogosławieństwo, Tarcza…) włącza się od razu; Klątwa czeka
-- na wybór ofiary (rzuc_klatwe); nagroda fizyczna idzie do kolejki wydań.
create function public.zrealizuj_wygrana(p_licytacja uuid, p_team uuid, p_cena integer, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item    public.shop_items;
  v_order   uuid;
  v_expires timestamptz := null;
begin
  select i.* into v_item
  from public.licytacje l join public.shop_items i on i.id = l.item_id
  where l.id = p_licytacja;

  insert into public.shop_orders (team_id, item_id, price_paid, ordered_by, status)
  values (p_team, v_item.id, p_cena, p_user, 'pending')
  returning id into v_order;

  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
  values
    (null, p_team, -p_cena, 'licytacja', 'Licytacja: ' || v_item.name, 'licytacja', p_licytacja::text, null);

  if v_item.kind = 'digital' and coalesce(v_item.effect_key, '') <> 'klatwa' then
    if v_item.effect_hours is not null then
      v_expires := now() + make_interval(hours => v_item.effect_hours);
    end if;
    insert into public.active_effects (scope, subject_id, effect_key, effect_value, expires_at, order_id)
    values ('team', p_team, v_item.effect_key, v_item.effect_value, v_expires, v_order);
    update public.shop_orders set status = 'fulfilled', fulfilled_at = now() where id = v_order;
  end if;

  return v_order;
end;
$$;

revoke execute on function public.zrealizuj_wygrana(uuid, uuid, integer, uuid) from public, anon, authenticated;

-- ---------- Co minutę: ogłoszenia otwarcia i zamknięcia ----------
create function public.licytacje_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l      public.licytacje;
  v_nazwa  text;
  v_kand   record;
  v_zw     uuid;
  v_cena   integer;
  v_user   uuid;
  v_order  uuid;
  v_saldo  integer;
  v_druz   text;
begin
  -- Otwarcie: raz na licytację, także dla wystawionych „od razu”.
  for v_l in
    select * from public.licytacje
    where status = 'trwa' and start <= now() and koniec > now() and not otwarcie_ogloszone
    for update skip locked
  loop
    select case when v_l.w_ciemno then 'Tajemnicza nagroda' else i.name end into v_nazwa
    from public.shop_items i where i.id = v_l.item_id;
    insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
    values ('push', 'all', 'Licytacja otwarta',
            v_nazwa || ' - cena wywoławcza ' || v_l.cena_wywolawcza || ' pkt',
            '/app/sklep', 'licytacja', v_l.id::text);
    update public.licytacje set otwarcie_ogloszone = true where id = v_l.id;
  end loop;

  -- Zamknięcie. `skip locked` + zmiana statusu w tej samej transakcji: drugi
  -- tick (albo równoległy) nie zamknie tej samej licytacji drugi raz.
  for v_l in
    select * from public.licytacje
    where status = 'trwa' and koniec <= now()
    for update skip locked
  loop
    v_zw := null; v_cena := null; v_user := null; v_order := null;

    -- Od najwyższej oferty w dół, każda drużyna swoją najwyższą ofertą;
    -- wygrywa pierwsza, która w tej chwili może zapłacić.
    for v_kand in
      select k.team_id, k.kwota, k.user_id
      from (
        select distinct on (o.team_id) o.team_id, o.kwota, o.user_id, o.created_at
        from public.licytacje_oferty o
        where o.licytacja_id = v_l.id
        order by o.team_id, o.kwota desc, o.created_at
      ) k
      order by k.kwota desc, k.created_at
    loop
      perform 1 from public.teams where id = v_kand.team_id for update;
      select coalesce(sum(delta), 0)::integer into v_saldo
      from public.points_ledger where team_id = v_kand.team_id;
      if v_saldo >= v_kand.kwota then
        v_zw := v_kand.team_id; v_cena := v_kand.kwota; v_user := v_kand.user_id;
        exit;
      end if;
    end loop;

    if v_zw is not null then
      v_order := public.zrealizuj_wygrana(v_l.id, v_zw, v_cena, v_user);
    end if;

    update public.licytacje
    set status = 'zamknieta', zwyciezca_team = v_zw, cena_koncowa = v_cena,
        order_id = v_order, otwarcie_ogloszone = true
    where id = v_l.id;

    -- Po zamknięciu nazwa jest jawna, także dla licytacji w ciemno.
    select i.name into v_nazwa from public.shop_items i where i.id = v_l.item_id;
    if v_zw is not null then
      select name into v_druz from public.teams where id = v_zw;
      insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
      values ('push', 'all', 'Licytacja rozstrzygnięta',
              v_druz || ' wygrywa: ' || v_nazwa || ' za ' || v_cena || ' pkt',
              '/app/sklep', 'licytacja', v_l.id::text);
    else
      insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
      values ('push', 'all', 'Licytacja zamknięta', v_nazwa || ': bez zwycięzcy',
              '/app/sklep', 'licytacja', v_l.id::text);
    end if;
  end loop;
end;
$$;

revoke execute on function public.licytacje_tick() from public, anon, authenticated;
grant execute on function public.licytacje_tick() to service_role;

select cron.schedule('licytacje', '* * * * *', 'select public.licytacje_tick()');

-- ---------- Klątwa: wybór ofiary po wygranej ----------
-- Kapitan zwycięskiej drużyny albo admin w jego imieniu. Logika Tarczy jak
-- w dawnym kup_z_polki: Tarcza ofiary pochłania rzut, inaczej ofiara traci
-- effect_value punktów.
create function public.rzuc_klatwe(p_order uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o       public.shop_orders;
  v_item    public.shop_items;
  v_tarcza  uuid;
  v_note    text := null;
  v_nazwa   text;
  v_blokada uuid;
begin
  select * into v_o from public.shop_orders where id = p_order;
  if v_o.id is null then
    raise exception 'ZAMOWIENIE_NIEAKTYWNE';
  end if;

  if not (
    public.is_admin()
    or (public.is_approved()
        and (select team_id from public.profiles where id = auth.uid()) = v_o.team_id
        and public.is_captain(v_o.team_id))
  ) then
    raise exception 'BRAK_UPRAWNIEN';
  end if;

  if p_target is null or p_target = v_o.team_id
     or not exists (select 1 from public.teams where id = p_target and not ukryta) then
    raise exception 'ZLY_CEL';
  end if;

  -- Blokady drużyn po id (jak w kup_z_polki - bez zakleszczeń przy wzajemnych klątwach).
  for v_blokada in
    select id from public.teams where id = v_o.team_id or id = p_target order by id
  loop
    perform 1 from public.teams where id = v_blokada for update;
  end loop;

  select * into v_o from public.shop_orders where id = p_order for update;
  select * into v_item from public.shop_items where id = v_o.item_id;
  if v_o.status <> 'pending' or v_o.target_team_id is not null or v_item.effect_key is distinct from 'klatwa' then
    raise exception 'ZAMOWIENIE_NIEAKTYWNE';
  end if;

  select name into v_nazwa from public.teams where id = v_o.team_id;

  select id into v_tarcza
  from public.active_effects
  where scope = 'team' and subject_id = p_target and effect_key = 'tarcza'
    and consumed_at is null and (expires_at is null or expires_at > now())
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
      (null, p_target, -v_item.effect_value, 'klatwa',
       'Klatwa od druzyny ' || v_nazwa, 'sklepik_klatwa', p_order::text, auth.uid());
  end if;

  update public.shop_orders
  set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = auth.uid(),
      target_team_id = p_target, note = v_note
  where id = p_order;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', p_target, 'Klątwa',
          'Drużyna ' || v_nazwa || ' rzuciła na was klątwę', '/app/sklep', 'shop_order', p_order::text);
end;
$$;

revoke execute on function public.rzuc_klatwe(uuid, uuid) from public, anon;
grant execute on function public.rzuc_klatwe(uuid, uuid) to authenticated;

-- ---------- Stary sklepik: zakup z półki zamknięty ----------
-- Funkcja zostaje (jej logika efektów ma testy), ale za bramką
-- `sklepik_otwarty` (domyślnie false). Licytacje zastępują sklepik.
insert into public.app_settings (key, value) values ('sklepik_otwarty', 'false'::jsonb)
on conflict (key) do nothing;

alter function public.kup_z_polki(uuid, uuid) rename to kup_z_polki_bez_bramki;
revoke execute on function public.kup_z_polki_bez_bramki(uuid, uuid) from public, anon, authenticated;

create function public.kup_z_polki(p_item_id uuid, p_target_team uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'sklepik_otwarty'), false) then
    raise exception 'SKLEPIK_ZAMKNIETY';
  end if;
  return public.kup_z_polki_bez_bramki(p_item_id, p_target_team);
end;
$$;

revoke execute on function public.kup_z_polki(uuid, uuid) from public, anon;
grant execute on function public.kup_z_polki(uuid, uuid) to authenticated;
