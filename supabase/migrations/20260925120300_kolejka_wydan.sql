-- ============================================================
-- Sekta Wyjazdowa — kolejka wydań
-- ============================================================

create function public.wydaj_zamowienie(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze wydawac zamowienia';
  end if;

  -- Blokada wiersza razem z warunkiem na status: drugi admin klikający to samo
  -- zamówienie zobaczy już zmieniony status i wyjdzie z czytelnym błędem.
  select id into v_id
  from public.shop_orders
  where id = p_order_id and status = 'pending'
  for update;

  if v_id is null then
    raise exception 'Zamowienie nie istnieje albo nie jest juz oczekujace';
  end if;

  update public.shop_orders
  set status       = 'fulfilled',
      fulfilled_by = auth.uid(),
      fulfilled_at = now()
  where id = p_order_id;
end;
$$;

revoke execute on function public.wydaj_zamowienie(uuid) from anon, public;
grant  execute on function public.wydaj_zamowienie(uuid) to authenticated;

-- Zwrot idzie dodatnim wierszem, nie usunięciem wpisu: bez tego pomyłka admina
-- — złe kliknięcie, pozycja, której fizycznie nie ma — jest nieodwracalna.
create function public.anuluj_zamowienie(
  p_order_id uuid,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.shop_orders;
  v_kind   public.shop_kind;
  v_stock  integer;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze anulowac zamowienia';
  end if;

  select * into v_order
  from public.shop_orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Nie ma takiego zamowienia';
  end if;

  select kind, stock into v_kind, v_stock
  from public.shop_items where id = v_order.item_id for update;

  -- Kolejność sprawdzeń jest treścią: pozycja cyfrowa nigdy nie jest 'pending',
  -- więc bez tego warunku admin dostałby komunikat o statusie i nie dowiedziałby
  -- się, dlaczego naprawdę nie da się tego cofnąć. Klątwa już zabrała ofierze
  -- punkty, a cofanie jej wymagałoby ruszania cudzego salda.
  if v_kind = 'digital' then
    raise exception 'Efektu cyfrowego nie da sie cofnac';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Anulowac mozna tylko zamowienia oczekujace';
  end if;

  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
  values
    (null, v_order.team_id, v_order.price_paid, 'sklepik_zwrot',
     'Anulowane zamowienie', 'sklepik_zwrot', p_order_id::text, auth.uid());

  if v_stock is not null then
    update public.shop_items set stock = stock + 1 where id = v_order.item_id;
  end if;

  update public.shop_orders
  set status = 'cancelled', note = p_note
  where id = p_order_id;
end;
$$;

revoke execute on function public.anuluj_zamowienie(uuid, text) from anon, public;
grant  execute on function public.anuluj_zamowienie(uuid, text) to authenticated;
