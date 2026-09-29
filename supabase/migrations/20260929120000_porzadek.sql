-- ============================================================
-- Sekta Wyjazdowa — porządek (plan 15b)
-- ============================================================
--
-- Liczniki kolejek admina i „przejrzane” w gossipach (spec porządku, D1, D4).

-- Dotąd admin mógł uzasadnienie tylko ukryć — nie było czego liczyć.
alter table gossip_votes add column przejrzane_at timestamptz;

-- ---------- Cztery kolejki, jedno zapytanie ----------
-- Jedno miejsce z definicją „czeka”: pasek, „Więcej” i Sanktuarium pokazują
-- to samo, bo liczy to jedna funkcja.
create function public.admin_kolejki()
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
    'zgloszenia', (select count(*) from public.registrations where status = 'pending'),
    'gossipy',    (select count(*) from public.gossip_votes where not hidden and przejrzane_at is null)
  );
end;
$$;

create function public.oznacz_przejrzane(p_glos uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moderuje gossipy';
  end if;
  update public.gossip_votes set przejrzane_at = coalesce(przejrzane_at, now()) where id = p_glos;
end;
$$;

-- Ukrycie to też decyzja moderatora — głos przestaje czekać.
create or replace function public.ukryj_uzasadnienie(p_glos uuid, p_ukryte boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moderuje gossipy';
  end if;
  update public.gossip_votes
  set hidden = coalesce(p_ukryte, true),
      przejrzane_at = coalesce(przejrzane_at, now())
  where id = p_glos;
end;
$$;

create or replace function public.moderacja_gossipow(p_kategoria uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moderuje gossipy';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id,
      'autor', coalesce(a.display_name, a.email),
      'na_kogo', coalesce(n.display_name, n.email),
      'tekst', v.justification,
      'ukryte', v.hidden,
      'przejrzane', v.przejrzane_at is not null,
      'kiedy', v.created_at
    ) order by v.created_at), '[]'::jsonb)
    from public.gossip_votes v
    join public.profiles a on a.id = v.voter_id
    join public.profiles n on n.id = v.nominee_id
    where v.category_id = p_kategoria
  );
end;
$$;

revoke execute on function public.admin_kolejki() from public, anon;
grant  execute on function public.admin_kolejki() to authenticated;
revoke execute on function public.oznacz_przejrzane(uuid) from public, anon;
grant  execute on function public.oznacz_przejrzane(uuid) to authenticated;
