-- Licznik zgłoszeń w Sanktuarium bez rezerwy (Mikołaj 2026-10-23: „mylące”).
-- Kolejka zgłoszeń i tak pokazuje tylko listę główną; rezerwa jest w Zapisach.
create or replace function public.admin_kolejki()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin widzi kolejki';
  end if;
  return jsonb_build_object(
    'sklepik',    (select count(*) from public.shop_orders where status = 'pending'),
    'bingo',      (select count(*) from public.bingo_submissions where status = 'pending'),
    'zgloszenia', (select count(*) from public.registrations where status = 'pending' and not rezerwa),
    'gossipy',    (select count(*) from public.gossip_votes where not hidden and przejrzane_at is null)
  );
end;
$$;
